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
            setIsActive(false);
            processor.disconnect();
            source.disconnect();
            audioContext.close();
            if ($('#recButton').hasClass('notRec')) {
              $('#recButton').removeClass('notRec');
              $('#recButton').addClass('Rec');
            } else {
              $('#recButton').removeClass('Rec');
              $('#recButton').addClass('notRec');
            }
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
                  <svg width="177px" height="177px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                    <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      {' '}
                      <circle cx="12" cy="6" r="4" fill="#7d7d87"></circle>{' '}
                      <path
                        d="M20 17.5C20 19.9853 20 22 12 22C4 22 4 19.9853 4 17.5C4 15.0147 7.58172 13 12 13C16.4183 13 20 15.0147 20 17.5Z"
                        fill="#7d7d87"
                      ></path>{' '}
                    </g>
                  </svg>
                </Button>
              </div>
              <div style={{ width: '100%', marginBottom: '50%', display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end' }}>
                <Button
                  onClick={() => {
                    stopRecording();
                    if ($('#recButton').hasClass('notRec')) {
                      $('#recButton').removeClass('notRec');
                      $('#recButton').addClass('Rec');
                    } else {
                      $('#recButton').removeClass('Rec');
                      $('#recButton').addClass('notRec');
                    }
                    setIsActive(false);
                  }}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '30px',
                    backgroundColor: 'red',
                    marginLeft: '15px',
                    background: '#fc2403',
                  }}
                >
                  <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#fc2403">
                    <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                    <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      {' '}
                      <path
                        d="M17.1519 16.2663L16.6145 13.848C16.4799 13.8132 16.3153 13.7736 16.1266 13.7339C15.5657 13.6158 14.8074 13.5 13.9999 13.5C13.1924 13.5 12.434 13.6158 11.8731 13.7339C11.6845 13.7736 11.5199 13.8132 11.3853 13.848L10.8479 16.2663C10.5604 17.5597 9.51656 18.5492 8.20957 18.767L6.10159 19.1184C4.45641 19.3926 2.87072 18.3769 2.43183 16.7678L2.22578 16.0124C1.72818 14.188 2.31138 12.0975 4.16042 11.1699C6.18942 10.1519 9.48668 8.99828 13.9999 8.99829C18.5131 8.9983 21.8103 10.152 23.8393 11.1699C25.6883 12.0975 26.2715 14.188 25.774 16.0123L25.5679 16.7678C25.129 18.3769 23.5433 19.3926 21.8981 19.1184L19.7902 18.767C18.4832 18.5492 17.4393 17.5597 17.1519 16.2663Z"
                        fill="#ffffff"
                      ></path>{' '}
                    </g>
                  </svg>
                </Button>
                <Button
                  id="recButton"
                  className="notRec"
                  onClick={() => {
                    startRecording();

                    if ($('#recButton').hasClass('notRec')) {
                      $('#recButton').removeClass('notRec');
                      $('#recButton').addClass('Rec');
                    } else {
                      $('#recButton').removeClass('Rec');
                      $('#recButton').addClass('notRec');
                    }
                  }}
                  style={{ width: '60px', height: '60px', borderRadius: '30px', fontSize: '12px', background: '#19d473' }}
                >
                  <svg fill="#ffffff" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" enable-background="new 0 0 100 100" stroke="#ffffff">
                    <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                    <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      {' '}
                      <path d="M77.7,63.9l-6.2-5c-2.1-1.7-5.1-1.801-7.3-0.2L58.3,63c-0.8,0.6-1.899,0.5-2.6-0.2L46,54l-8.9-9.8 c-0.7-0.7-0.8-1.8-0.2-2.6l4.3-5.9c1.6-2.2,1.5-5.2-0.2-7.3l-5-6.2c-2.2-2.8-6.4-3-8.9-0.5l-5.4,5.4c-1.2,1.2-1.8,2.9-1.8,4.5 c0.7,12.7,6.5,24.8,15,33.3s20.5,14.3,33.3,15c1.7,0.1,3.3-0.601,4.5-1.801L78.1,72.7C80.8,70.3,80.5,66.1,77.7,63.9z"></path>{' '}
                    </g>
                  </svg>
                </Button>
              </div>
            </div>
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                style={{ width: '60px', height: '60px', borderRadius: '30px', marginTop: '12px', background: '#19d473' }}
                onClick={() => {
                  setIsActive(true);
                }}
              >
                <svg fill="#ffffff" viewBox="-9.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff">
                  <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                  <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    {' '}
                    <title>record</title>{' '}
                    <path d="M2.656 11.25v-2.969c0-1.906 1.719-3.5 3.906-3.5 2.156 0 3.906 1.594 3.906 3.5v2.969h-7.813zM13.188 11.438v5.969c-1.281 3.5-5.063 4.031-5.063 4.031v3.969h4.156v1.781h-11.438v-1.781h4.188v-3.969s-3.75-0.531-5.031-4.031v-5.969l1.531-0.719v5.438s0.469 3.656 5.031 3.656 5.094-3.656 5.094-3.656v-5.438zM10.469 12.281v2.688c0 1.906-1.75 3.5-3.906 3.5-2.188 0-3.906-1.594-3.906-3.5v-2.688h7.813z"></path>{' '}
                  </g>
                </svg>
              </Button>
            </div>
          </Chat>
        </RuntimeAPIProvider>
      </ChatWindow.Container>
    </DemoContainer>
  );
};
