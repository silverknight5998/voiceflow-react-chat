import 'react-calendar/dist/Calendar.css';
import './app.css';
import { Chat, ChatWindow, Launcher, RuntimeAPIProvider, SessionStatus, SystemResponse, TurnType, UserResponse, Button } from '@voiceflow/react-chat';
import { useContext, useState, useEffect, useMemo } from 'react';
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
  const [open, setOpen] = useState(true);
  const { runtime } = useContext(RuntimeContext)!;
  const [isActive, setIsActive] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [resume, setResume] = useState(false);
  const [text, setText] = useState('');
  const liveAgent = useLiveAgent();
  const message = useMemo(() => {
    return text;
  }, [text]);

  useEffect(() => {
    handleOpen();
  }, []);

  useEffect(() => {
    const audioPlay = async () => {
      const res = await axios.post(
        'https://api.tradies-success-academy.com/api/audio',
        {
          transcript: message,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      let byteCharacters = atob(res.data);

      // Create an array of byte numbers from the raw binary data
      let byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      // Create a Blob from the byte numbers
      let byteArray = new Uint8Array(byteNumbers);
      let blob = new Blob([byteArray], { type: 'audio/mp3' });

      // Create a URL for the Blob and play the audio
      let url = URL.createObjectURL(blob);
      let audio = new Audio(url);
      audio.play();
      if (isActive) {
        startRecording();
        $('#recButton').removeClass('notRec');
        $('#recButton').addClass('Rec');
      }
    };
    if (message) audioPlay();
  }, [message]);

  const handleLaunch = async () => {
    // await runtime.launch();
    setOpen(true);
  };

  const handleOpen = async () => {
    await runtime.launch();
  };

  const handleEnd = () => {
    // runtime.setStatus(SessionStatus.ENDED);
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
    const silenceDuration = 1; // 2 seconds

    processor.onaudioprocess = function (event) {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      checkForSilence(inputBuffer);
    };
    function checkForSilence(inputBuffer: any) {
      const isSilent = isBufferSilent(inputBuffer);
      if (isSilent) {
        if (Date.now() - silenceStart > silenceDuration * 1000) {
          if (mediaRecorder.state === 'recording') {
            if (resume) {
              console.log('pause');
              mediaRecorder.pause();
              $('#recButton').removeClass('Rec');
              $('#recButton').addClass('notRec');
            } else {
              console.log('stop');
              processor.disconnect();
              source.disconnect();
              mediaRecorder.stop();
              setResume(true);
            }
          }
        }
      } else {
        silenceStart = Date.now();
        if (mediaRecorder.state === 'paused') {
          console.log('resume');
          mediaRecorder.resume();
          $('#recButton').removeClass('notRec');
          $('#recButton').addClass('Rec');
        }
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
      const formData = new FormData();
      const audioBlob = new Blob(chunks);
      formData.append('file', audioBlob, `${runtime.session.userID}.wav`);
      formData.append('name', runtime.session.userID);
      const response = await axios.post('https://api.tradies-success-academy.com/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const transcripts = await axios.post(
        'https://api.tradies-success-academy.com/api/transcribe',
        {
          filename: `${runtime.session.userID}.wav`,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      runtime.reply(transcripts.data);
      // startRecording();
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

  return (
    <>
      {!open && (
        <span
          style={{
            position: 'absolute',
            right: '2rem',
            bottom: '2rem',
            zIndex: '300',
          }}
        >
          <Launcher onClick={handleLaunch} />
        </span>
      )}
      <DemoContainer
        style={{
          boxShadow: '0 2px 48px rgba(19,33,68,0.16), 0 0 0 1px var(--shadows-shadow4)',
          transitionProperty: 'all',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          transitionDuration: '150ms',
          opacity: open ? '1' : '0',
          transform: `translateY(${open ? '0px' : '300px'})`,
        }}
      >
        <ChatWindow.Container
          style={{
            overflow: 'hidden',
            border: '1px solid #000000',
            borderRadius: '28px',
          }}
        >
          <RuntimeAPIProvider {...runtime}>
            <Chat
              title="My Assistant"
              description="welcome to my assistant"
              image={IMAGE}
              avatar={AVATAR}
              withWatermark
              startTime={runtime.session.startTime}
              // hasEnded={runtime.isStatus(SessionStatus.ENDED)}
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
                      Message={({ message, ...props }) => {
                        return match(message)
                          .with({ type: CustomMessage.CALENDAR }, ({ payload: { today } }) => (
                            <CalendarMessage {...props} value={new Date(today)} runtime={runtime} />
                          ))
                          .with({ type: CustomMessage.VIDEO }, ({ payload: url }) => <VideoMessage url={url} />)
                          .with({ type: CustomMessage.STREAMED_RESPONSE }, ({ payload: { getSocket } }) => <StreamedMessage getSocket={getSocket} />)
                          .with({ type: CustomMessage.PLUGIN }, ({ payload: { Message } }) => <Message />)
                          .otherwise(() => {
                            //@ts-ignore
                            if (message.text && message.text.length && message.text[0].children && message.text[0].children.length) {
                              //@ts-ignore
                              setText(message.text[0].children[0].text);
                            }
                            return <SystemResponse.SystemMessage {...props} message={message} />;
                          });
                      }}
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
                    <img style={{ width: '200px', height: '200px', borderRadius: '100px', background: '#9fa3ab' }} src="/assets/user.png" />
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
                  <img style={{ width: '60px', height: '60px' }} src="/assets/record.png" />
                </Button>
              </div>
            </Chat>
          </RuntimeAPIProvider>
        </ChatWindow.Container>
      </DemoContainer>
    </>
  );
};
