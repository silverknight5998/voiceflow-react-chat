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
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

export const Demo: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const { runtime } = useContext(RuntimeContext)!;

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
    console.log(runtime);
    if (liveAgent.isEnabled) {
      liveAgent.sendUserReply(message);
    } else {
      runtime.reply(message);
    }
  };

  useEffect(() => {
    if (recording) {
      recognition.start();
      recognition.onend = () => {
        console.log('...continue listening...');
        recognition.start();
      };
    } else {
      recognition.stop();
      recognition.onend = () => {
        console.log('Stopped listening per click');
      };
      runtime.reply(transcript);
    }
    recognition.onstart = () => {
      console.log('Listening!');
    };

    let finalTranscript = '';
    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript + ' ';
        else interimTranscript += transcript;
      }
      console.log(finalTranscript, interimTranscript);
      setTranscript(finalTranscript);
    };

    recognition.onerror = (event) => {
      console.log('Error occurred in recognition: ' + event.error);
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
                  }}
                  style={{ width: '50px', height: '50px', borderRadius: '25px', fontSize: '12px' }}
                >
                  Record
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setRecording(false);
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
