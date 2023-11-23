import 'react-calendar/dist/Calendar.css';
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

const IMAGE = 'https://icons8.com/icon/5zuVgEwv1rTz/website';
const AVATAR = 'https://icons8.com/icon/5zuVgEwv1rTz/website';

export const Demo: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { runtime } = useContext(RuntimeContext)!;
  const [recording, setRecording] = useState(false);
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
    setRecording(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    const chunks: any = [];
    mediaRecorder.addEventListener('dataavailable', (event) => {
      chunks.push(event.data);
    });

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

    setRecording(true);
    setMediaRecorder(mediaRecorder);
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      setRecording(false);
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
            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <Button
                onClick={() => {
                  stopRecording();
                }}
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '25px',
                  fontSize: '12px',
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
                onClick={() => {
                  startRecording();
                }}
                style={{ width: '50px', height: '50px', borderRadius: '25px', fontSize: '12px', background: '#19d473' }}
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
          </Chat>
        </RuntimeAPIProvider>
      </ChatWindow.Container>
    </DemoContainer>
  );
};
