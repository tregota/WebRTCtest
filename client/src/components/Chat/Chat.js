import React, { useEffect, useRef, useState, useCallback } from 'react';
import {isMobile} from 'react-device-detect';
import { withStyles } from '@material-ui/core/styles';
import useWebSocket from '../../hooks/useWebSocket';
import useWebRTC from '../../hooks/useWebRTC';
import TextField from '@material-ui/core/TextField';
import Message from './Message'
import Status from './Status'

const styles = {  
  wrapper: {
    minHeight: "100vh"
  },
  pageFooter: {
    textAlign: "left",
    maxHeight: "100px",
    overflow: "scroll",
    background: "#eee"
  },
  users: {
    position: "absolute",
    top: "20px",
    left: "20px",
    minWidth: "150px",
    padding: 0,
    border: "1px solid #eee",
    background: "white",
    "-webkit-box-shadow": "2px 2px 10px -4px rgba(0,0,0,0.1)",
    "-moz-box-shadow": "2px 2px 10px -4px rgba(0,0,0,0.1)",
    "box-shadow": "2px 2px 10px -4px rgba(0,0,0,0.1)"
  },
  user: {
    position: "relative",
    borderBottom: "1px solid #eee",
    padding: "4px"
  },
  userIcon: {
    verticalAlign: "middle", 
    fontSize: "18px",
    marginTop: "-4px"
  },
  userConnected: {
    position: "relative",
    borderBottom: "1px solid #eee",
    padding: "4px",
    background: "#ecffec"
  },
  chat: {
    height: 'calc(var(--vh, 1vh)*100 - 116px)',
    padding: '0 20px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  chatInput: {
    width: 'calc(100% - 40px)',
    padding: '20px',
    color: 'black',
    '& textarea': {
      zIndex: 1
    },
    '& input': {
      zIndex: 1
    },
    '& fieldset': {
      background: 'white'
    },
    "&:after": {
      content: '""',
      position: "absolute",
      display: "block",
      borderStyle: "solid",
      borderWidth: "9px 0 0 11px",
      borderColor: "rgba(0, 0, 0, 0.23) transparent transparent transparent",
      bottom: "11px",
      right: "29px",
    }
  },
  fullscreenVideo: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '100%',
    maxHeight: '100%',
    pointerEvents: 'none'
  },
  ownVideo: {
    position: 'fixed',
    top: 10,
    right: 10,
    width: '200px',
    zIndex: 2
  }
}

const Chat = ({classes}) => {
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const [users, setUsers] = useState([]);
  const [chatLines, setChatLines] = useState([]);
  const newMessage = (userId, text, type="message") => {
    setChatLines((chatLines) => [...chatLines, { userId, text, type }]);
  }

  // webrtc stuff
  const ownVideo = useRef();
  const fullscreenVideo = useRef();
  const userStream = useRef(null);

  useEffect(() => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    const resizeEvent = window.addEventListener('resize', () => {
      let vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    });

    return () => {
      window.removeEventListener('resize', resizeEvent);
    }
  }, []);

  let room = window.location.pathname.substring(1);
  if(!room) {
    room = "lobby"
  }

  const ws = useWebSocket({
    url: `ws://${window.location.hostname}:5000/${room}${window.location.search}`,
    keepAlive: 20
  })
  ws.on("handshake", (data) => {
    setUsers(data.users.map(u => ({...u, online: true})));
    call(data.users);
  });
  ws.on("user:connect", (data) => {
    setUsers((users) => [...users, {...data.user, online: true}]);
  });
  ws.on("user:disconnect", (data) => {
    setUsers((users) => [...users.filter(u => u.id !== data.id), { ...users.find(u => u.id === data.id), online: false }]);
    wRTC.close(data.id);
    newMessage(data.id, 'disconnected', 'status');
  });
  ws.on("user:rename", (data) => {
    newMessage(data.user.id, 'renamed to '+data.user.name, 'status');
    setUsers((users) => [...users.filter(u => u.id !== data.user.id), data.user]);
  });
  ws.on("close", () => {
    console.log("websocket disconnected");
  });

  const wRTC = useWebRTC(ws, {
    onConnection: (con) => {
      con.addEventListener('track', e => {
        fullscreenVideo.current.srcObject = e.streams[0];
      })
      newMessage(con.target, 'is online', 'status');
    },
    
    allowPassThrough: false
  });
  wRTC.on('message', (message) => {
    newMessage(message.source, message.data);
  })

  const call = async (callUsers) => {
    callUsers.forEach(user => {
      console.log('calling: ' + user.name);
      wRTC.connect(user.id);
    });
  }

  const sendMessage = (message) => {
    newMessage("me" ,message);
    wRTC.send('message', message);
  }

  const stream = async () => {
    userStream.current = await navigator.mediaDevices.getDisplayMedia({ cursor: true, video: true, audio: true });
    ownVideo.current.srcObject = userStream.current;
    for(const connection of Object.values(wRTC.connections)) {
      const senders = connection.rawConnection.getSenders();
      if(senders.length){
        if ("removeTrack" in connection.rawConnection) {
          connection.rawConnection.removeTrack(connection.rawConnection.getSenders()[0]);
        } else {
          connection.rawConnection.removeStream(userStream.current);
        }
      }
      connection.rawConnection.addStream(userStream.current);
    }
  }

  const fullscreen = () => {
    if (fullscreenVideo.current.requestFullscreen) 
      fullscreenVideo.current.requestFullscreen();
    else if (fullscreenVideo.current.webkitRequestFullscreen) 
      fullscreenVideo.current.webkitRequestFullscreen();
    else if (fullscreenVideo.current.msRequestFullScreen) 
      fullscreenVideo.current.msRequestFullScreen();
  }

  return (
    <React.Fragment>
      {/* { ws.isOpen() && users.length ? 
          <div className={classes.users}>
            {users.filter(user => user.online).map((user, idx) => 
              <div className={user.id in wRTC.connections && wRTC.connections[user.id].connectionState === 'connected' ? classes.userConnected : classes.user} key={user.id}>
                <PersonRoundedIcon className={classes.userIcon} />
                {user.name || user.id}
              </div>)
            }
          </div>
        : undefined
      } */}
      <video className={classes.fullscreenVideo} autoPlay ref={fullscreenVideo} /> 
      <video className={classes.ownVideo} autoPlay muted ref={ownVideo} />
      <div className={classes.wrapper}>
        <div className={classes.chat}>
          {chatLines.map((line, idx) => {
            if(line.type === 'status') {
              return <Status key={idx} users={users} userId={line.userId} status={line.text} />;
            }
            return <Message key={idx} users={users} userId={line.userId} message={line.text} outgoing={line.userId==="me"} />;
          })}
        </div>
        <TextField
          className={classes.chatInput}
          InputProps={{
            onKeyDown: (e) => {
              if (e.key === 'Enter' && !e.ctrlKey) {
                if(e.target.value) {
                  sendMessage(e.target.value)
                  e.target.value = '';
                }
                e.preventDefault();
              }
              else if (e.key === 'Enter' && e.ctrlKey) {
                e.target.value = e.target.value + "\n";
                forceUpdate()
              }
            }
          }}
          placeholder="message"
          variant="outlined"
          multiline={!isMobile}
        />
      </div>
      { navigator.mediaDevices && <button onClick={() => stream()}>stream</button> }
      <button onClick={() => fullscreen()}>fullscreen</button> 
    </React.Fragment>
  )
};

// Chat.defaultProps = {};

export default withStyles(styles)(Chat);
