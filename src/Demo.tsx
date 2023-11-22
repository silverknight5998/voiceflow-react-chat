import 'react-calendar/dist/Calendar.css';

import { Chat, ChatWindow, Launcher, RuntimeAPIProvider, SessionStatus, SystemResponse, TurnType, UserResponse, Button } from '@voiceflow/react-chat';
import { useContext, useState, useEffect } from 'react';
import { match } from 'ts-pattern';

import { LiveAgentStatus } from './components/LiveAgentStatus.component';
import { StreamedMessage } from './components/StreamedMessage.component';
import { RuntimeContext } from './context';
import { CustomMessage } from './custom-message.enum';
import { CalendarMessage } from './messages/CalendarMessage.component';
import { VideoMessage } from './messages/VideoMessage.component';
import { DemoContainer } from './styled';
import { useLiveAgent } from './use-live-agent.hook';

const IMAGE = 'https://icons8.com/icon/5zuVgEwv1rTz/website';
const AVATAR = 'https://icons8.com/icon/5zuVgEwv1rTz/website';
//@ts-ignore

export const Demo: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const { runtime } = useContext(RuntimeContext)!;
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const liveAgent = useLiveAgent();

  const handleLaunch = async () => {
    setOpen(true);
    await runtime.launch();
  };

  const handleEnd = () => {
    runtime.setStatus(SessionStatus.ENDED);
    setOpen(false);
  };

  const handleSend = (message: string) => {
    if (liveAgent.isEnabled) {
      liveAgent.sendUserReply(message);
    } else {
      runtime.reply(message);
    }
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    setMediaRecorder(mediaRecorder);

    mediaRecorder.start();

    mediaRecorder.ondataavailable = (event) => {
      console.log('data', event.data);
      setAudioChunks([...audioChunks, event.data]);
    };
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();

      mediaRecorder.onstop = async () => {
        console.log('audioCHunks', audioChunks);
        const audioBlob = new Blob(audioChunks);
        console.log(audioBlob, audioBlob.type);
        const formData = new FormData();
        formData.append('file', new File([audioBlob], 'audio.wav', { type: audioBlob.type }));
        console.log('formData', formData);
        const response = await fetch('localhost:4000/upload', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
          body: formData,
        });
        console.log('response', response);
        setAudioChunks([]);
      };
    }
  };

  if (!open) {
    return (
      <span
        style={{
          position: 'absolute',
          right: '2rem',
          bottom: '2rem',
        }}
      >
        <Launcher onClick={handleLaunch} />
      </span>
    );
  }
  console.log('tran', transcript);
  return (
    <DemoContainer>
      <ChatWindow.Container>
        <RuntimeAPIProvider {...runtime}>
          <Chat
            title="My Assistant"
            description="welcome to my assistant"
            image={IMAGE}
            avatar={AVATAR}
            withWatermark
            startTime={runtime.session.startTime}
            hasEnded={runtime.isStatus(SessionStatus.ENDED)}
            isLoading={!runtime.session.turns.length}
            onStart={runtime.launch}
            onEnd={handleEnd}
            onSend={handleSend}
            onMinimize={handleEnd}
          >
            {liveAgent.isEnabled && <LiveAgentStatus talkToRobot={liveAgent.talkToRobot} />}
            {runtime.session.turns.map((turn, turnIndex) =>
              match(turn)
                .with({ type: TurnType.USER }, ({ id, type: _, ...rest }) => <UserResponse {...rest} key={id} />)
                .with({ type: TurnType.SYSTEM }, ({ id, type: _, ...rest }) => (
                  <SystemResponse
                    {...rest}
                    key={id}
                    Message={({ message, ...props }) =>
                      match(message)
                        .with({ type: CustomMessage.CALENDAR }, ({ payload: { today } }) => (
                          <CalendarMessage {...props} value={new Date(today)} runtime={runtime} />
                        ))
                        .with({ type: CustomMessage.VIDEO }, ({ payload: url }) => <VideoMessage url={url} />)
                        .with({ type: CustomMessage.STREAMED_RESPONSE }, ({ payload: { getSocket } }) => <StreamedMessage getSocket={getSocket} />)
                        .with({ type: CustomMessage.PLUGIN }, ({ payload: { Message } }) => <Message />)
                        .otherwise(() => <SystemResponse.SystemMessage {...props} message={message} />)
                    }
                    avatar={AVATAR}
                    isLast={turnIndex === runtime.session.turns.length - 1}
                  />
                ))
                .exhaustive()
            )}
            {runtime.indicator && <SystemResponse.Indicator avatar={AVATAR} />}
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
              {!recording ? (
                <Button
                  onClick={() => {
                    setRecording(true);
                    startRecording();
                  }}
                  style={{ width: '50px', height: '50px', borderRadius: '25px', fontSize: '12px' }}
                >
                  Record
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setRecording(false);
                    stopRecording();
                  }}
                  style={{ width: '50px', height: '50px', borderRadius: '25px', fontSize: '12px', backgroundColor: 'red', marginRight: '5px' }}
                >
                  Stop
                </Button>
              )}
            </div>
          </Chat>
        </RuntimeAPIProvider>
      </ChatWindow.Container>
    </DemoContainer>
  );
};
