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
  const [open, setOpen] = useState(false);
  const { runtime } = useContext(RuntimeContext)!;
  const [isActive, setIsActive] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [flag, setFlag] = useState(false);
  const [text, setText] = useState('');
  const liveAgent = useLiveAgent();

  const message = useMemo(() => {
    return text;
  }, [text]);

  useEffect(() => {
    if (message) {
      const play = async () => {
        const url = await audioPlay(message);
        let audio = new Audio(url);
        audio.play();
        audio.onended = function () {
          setFlag(false);
        };
      }
      play();
    };
  }, [message]);

  const audioPlay = async (text: string) => {
    const res = await axios.post(
      'https://api.tradies-success-academy.com/api/audio',
      {
        transcript: text,
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
    return url;
  };
  const handleLaunch = async () => {
    setOpen(true);
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
      if (event.data.size > 0)
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
            console.log("stop");
            mediaRecorder.stop();
            $('#recButton').removeClass('Rec');
            $('#recButton').addClass('notRec');
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
      setFlag(true);
      const formData = new FormData();
      const audioBlob = new Blob(chunks);
      formData.append('file', audioBlob, `${runtime.session.userID}.wav`);
      formData.append('name', runtime.session.userID);

      const transcripts = await axios.post(
        'https://api.tradies-success-academy.com/api/transcribe',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        }
      );
      if (transcripts.data)
        runtime.reply(transcripts.data);
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
            position: 'fixed',
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
          padding: '40px',
        }}
      >
        <ChatWindow.Container
          style={{
            overflow: 'hidden',
            boxShadow: '0 2px 48px rgba(19,33,68,0.16), 0 0 0 1px var(--shadows-shadow4)',
            borderRadius: '10px',
            transitionProperty: 'all',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            transitionDuration: '150ms',
            opacity: open ? '1' : '0',
            transform: `translateY(${open ? '0px' : '300px'})`,
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
                              setText(message.text[0].children[0].text !== "" ? message.text[0].children[0].text : message.text[0].children[1].text);
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
                      zIndex: 300,
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
                    className="notRec"
                    onClick={() => {
                      stopRecording();
                      setIsActive(false);
                    }}
                  ></Button>
                </div>
              </div>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  style={{ width: '60px', height: '60px', borderRadius: '30px', marginTop: '12px', background: '#19d473' }}
                  disabled={isActive ? true : false}
                  onClick={async () => {
                    setIsActive(true);
                    const url = await audioPlay("Hello, i am lixi and i am here to help you.");
                    let audio = new Audio(url);
                    audio.play();
                    audio.onended = function () {
                      $('#recButton').removeClass('notRec');
                      $('#recButton').addClass('Rec');
                      startRecording();
                    };
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
