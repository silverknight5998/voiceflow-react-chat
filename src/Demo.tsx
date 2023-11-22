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

const IMAGE = 'https://picsum.photos/seed/1/200/300';
const AVATAR = 'https://picsum.photos/seed/1/80/80';

export const Demo: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [save, setSave] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioURL, setAudioURL] = useState<string>('');
  const [recordingTime, setRecordingTime] = useState(0);
  const { runtime } = useContext(RuntimeContext)!;
  console.log('****audioURL', audioURL);
  console.log('****save', save);
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

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timerId: NodeJS.Timeout | null = null;

    if (recording) {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            setMediaRecorder(new MediaRecorder(stream));
            setAudioURL('');
            setRecordingTime(0);
            timerId = setInterval(() => {
              setRecordingTime((time) => time + 1);
            }, 1000);
          })
          .catch((error) => {
            console.error('Error accessing microphone:', error);
            setSave(0);
          });
      } else {
        setSave(0);
        console.log('Browser does not support MediaDevices.getUserMedia');
      }
    } else {
      if (mediaRecorder) {
        mediaRecorder.stop();
        mediaRecorder.ondataavailable = (e) => {
          const audioBlob = new Blob([e.data], { type: 'audio/webm' });
          const url = URL.createObjectURL(audioBlob);
          setAudioURL(url);
        };
      }

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (timerId) {
        clearInterval(timerId);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [recording]);

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

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
            <div style={{ marginTop: '10px' }}>
              {save === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    onClick={() => {
                      setRecording(true);
                      setSave(2);
                    }}
                    style={{ width: '50px', height: '50px', borderRadius: '25px', fontSize: '12px' }}
                  >
                    Record
                  </Button>
                </div>
              ) : save === 2 ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    onClick={() => {
                      setRecording(false);
                      setSave(1);
                    }}
                    style={{ width: '50px', height: '50px', borderRadius: '25px', fontSize: '12px', backgroundColor: 'red', marginRight: '5px' }}
                  >
                    Stop
                  </Button>
                  <p>{formatTime(recordingTime)}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    onClick={() => setSave(0)}
                    style={{
                      width: '50px',
                      height: '50px',
                      marginLeft: '15px',
                      color: '#3d82e2',
                      backgroundColor: 'white',
                      border: '1px solid #3d82e2',
                      borderRadius: '25px',
                      fontSize: '12px',
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => setSave(0)} style={{ width: '50px', height: '50px', borderRadius: '25px', fontSize: '12px' }}>
                    Save
                  </Button>
                </div>
              )}
            </div>
          </Chat>
        </RuntimeAPIProvider>
      </ChatWindow.Container>
    </DemoContainer>
  );
};
