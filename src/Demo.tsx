import 'react-calendar/dist/Calendar.css';
import './app.css';
import { Chat, ChatWindow, Launcher, RuntimeAPIProvider, SessionStatus, SystemResponse, TurnType, UserResponse, Button } from '@voiceflow/react-chat';
import { useContext, useState } from 'react';
import { match } from 'ts-pattern';
import axios from 'axios';
import { LiveAgentStatus } from './components/LiveAgentStatus.component';
import { StreamedMessage } from './components/StreamedMessage.component';
import { RuntimeContext } from './context';
import { CustomMessage } from './custom-message.enum';
import { CalendarMessage } from './messages/CalendarMessage.component';
import { VideoMessage } from './messages/VideoMessage.component';
import { DemoContainer } from './styled';
import { useLiveAgent } from './use-live-agent.hook';
//@ts-ignore
import $ from 'jquery';
const IMAGE = 'https://icons8.com/icon/5zuVgEwv1rTz/website';
const AVATAR = 'https://icons8.com/icon/5zuVgEwv1rTz/website';

export const Demo: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { runtime } = useContext(RuntimeContext)!;
  const [isActive, setIsActive] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
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
    mediaRecorder.start();

    const chunks: any = [];
    mediaRecorder.addEventListener('dataavailable', (event) => {
      chunks.push(event.data);
    });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(1024, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    let silenceStart = Date.now();
    const silenceDuration = 2; // 2 seconds

    processor.onaudioprocess = function (event) {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      checkForSilence(inputBuffer);
    };

    function checkForSilence(inputBuffer: any) {
      const isSilent = isBufferSilent(inputBuffer);
      if (isSilent) {
        if (Date.now() - silenceStart > silenceDuration * 1000) {
          if (mediaRecorder.state === 'recording') {
            processor.disconnect();
            source.disconnect();
            mediaRecorder.stop();
            $('#recButton').removeClass('Rec');
            $('#recButton').addClass('notRec');
            // setIsActive(false);
          }
        }
      } else {
        silenceStart = Date.now();
      }
    }

    function isBufferSilent(buffer: any) {
      const threshold = 0.02;
      for (let i = 0; i < buffer.length; i++) {
        if (Math.abs(buffer[i]) > threshold) {
          return false;
        }
      }
      return true;
    }

    mediaRecorder.onstop = async () => {
      console.log('stop');
      const formData = new FormData();
      const audioBlob = new Blob(chunks);
      formData.append('file', audioBlob, 'audio.wav');
      const response = await axios.post('https://api.tradies-success-academy.com/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const transcripts = await axios.post(
        'https://api.tradies-success-academy.com/api/transcribe',
        {
          filename: response.data,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      runtime.reply(transcripts.data);
      startRecording();
      $('#recButton').removeClass('notRec');
      $('#recButton').addClass('Rec');
    };

    setMediaRecorder(mediaRecorder);
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
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
            <div
              style={
                isActive
                  ? {
                      flexDirection: 'column',
                      justifyContent: 'space-evenly',
                      width: '100%',
                      height: '100%',
                      background: '#262b2a',
                      position: 'absolute',
                      display: 'flex',
                      marginLeft: '0%',
                      transition: 'ease-in',
                    }
                  : { display: 'none', marginLeft: '-100%' }
              }
            >
              <div
                style={{
                  marginTop: '10%',
                  width: '100%',
                  marginBottom: '50%',
                  display: 'flex',
                  justifyContent: 'space-around',
                  alignItems: 'flex-end',
                }}
              >
                <Button
                  style={{
                    width: '200px',
                    height: '200px',
                    borderRadius: '100px',
                    background: '#9fa3ab',
                  }}
                >
                  <img style={{ width: '200px', height: '200px', borderRadius: '100px', background: '#9fa3ab' }} src="/src/assets/user.png" />
                </Button>
              </div>
              <div style={{ width: '100%', marginBottom: '50%', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
                <Button
                  id="recButton"
                  className="Rec"
                  onClick={() => {
                    stopRecording();
                    setIsActive(false);
                  }}
                  style={{ width: '60px', height: '60px', borderRadius: '30px', fontSize: '12px', background: 'red' }}
                ></Button>
              </div>
            </div>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                style={{ width: '60px', height: '60px', borderRadius: '30px', marginTop: '12px', background: '#19d473' }}
                onClick={() => {
                  startRecording();
                  setIsActive(true);
                }}
              >
                <img style={{ width: '60px', height: '60px' }} src="/src/assets/record.png" />
              </Button>
            </div>
          </Chat>
        </RuntimeAPIProvider>
      </ChatWindow.Container>
    </DemoContainer>
  );
};
