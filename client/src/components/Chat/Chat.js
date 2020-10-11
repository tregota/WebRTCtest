import React, { useEffect, useRef, useState, useCallback } from 'react';
import { withStyles } from '@material-ui/core/styles';
import PersonRoundedIcon from '@material-ui/icons/PersonRounded';
import useWebSocket from '../../hooks/useWebSocket';
import useWebRTC from '../../hooks/useWebRTC';
import TextField from '@material-ui/core/TextField';
import Message from './Message'

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
    height: 'calc(100vh - 116px)',
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
    '& fieldset': {
      background: 'white'
    }
  },
  fullscreenVideo: {
    position: 'fixed',
    left: 0,
    top: 0,
    width: '100%',
    maxHeight: '100%',
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
  const newMessage = (userId, message) => {
    setChatLines((chatLines) => [...chatLines, { userId, message: message }]);
  }

  // logging
  const [logLines, setLogLines] = useState([]);
  const writeToLog = (text) => {
    setLogLines((logLines) => [...logLines, text]);
  }
  const logElemRef = useRef(null);
  useEffect(() => {
    if(logElemRef.current) logElemRef.current.scrollTop = logElemRef.current.scrollHeight;
  }, [logLines]);
  // webrtc stuff
  const ownVideo = useRef();
  const fullscreenVideo = useRef();
  const userStream = useRef(null);

  useEffect(() => {
    // if(userStream.current == null && navigator.mediaDevices) {
    //   navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
    //     userVideo.current.srcObject = stream;
    //     userStream.current = stream;
    //   });
    // }
    // if(userStream.current == null && navigator.mediaDevices) {
    //   navigator.mediaDevices.getDisplayMedia({ cursor: true }).then(stream => {
    //     userVideo.current.srcObject = stream;
    //     userStream.current = stream;
    //   });
    // }
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
  });
  ws.on("user:rename", (data) => {
    setUsers((users) => [...users.filter(u => u.id !== data.user.id), data.user]);
  });
  ws.on("close", () => {
    writeToLog("websocket disconnected");
  });

  const wRTC = useWebRTC(ws, {
    onConnection: (con) => {
      con.addEventListener('track', (e) => {
        fullscreenVideo.current.srcObject = e.streams[0];
      })
    },
    allowPassThrough: true
  });
  wRTC.on('message', (message) => {
    newMessage(message.source, message.data);
  })

  const call = async (callUsers) => {
    callUsers.forEach(user => {
      writeToLog('calling: ' + user.name);
      wRTC.connect(user.id);
    });
    
    // userStream.current && userStream.current.getTracks().forEach(track => connection.addTrack(track, userStream.current));
  }

  const sendMessage = (message) => {
    newMessage("me" ,message);
    wRTC.send('message', message);
  }

  const stream = async () => {
    userStream.current = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
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

  return (
    <React.Fragment>
      { ws.isOpen() && users.length ? 
          <div className={classes.users}>
            {users.filter(user => user.online).map((user, idx) => 
              <div className={user.id in wRTC.connections && wRTC.connections[user.id].connectionState === 'connected' ? classes.userConnected : classes.user} key={user.id}>
                <PersonRoundedIcon className={classes.userIcon} />
                {user.name || user.id}
              </div>)
            }
          </div>
          : undefined
        }
      <video className={classes.fullscreenVideo} autoPlay ref={fullscreenVideo} /> 
      <video className={classes.ownVideo} autoPlay ref={ownVideo} />
      <div className={classes.wrapper}>
        <div className={classes.chat}>
          {chatLines.map((line, idx) => <Message key={idx} users={users} userId={line.userId} message={line.message} outgoing={line.userId==="me"} />)}
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
          multiline={true}
        />
        {/* <footer className={classes.pageFooter} ref={logElemRef}>
          {logLines.map((line, idx) => <div key={idx}>{line}</div>)}
        </footer> */}
      </div>
      {/* <button onClick={() => stream()}>stream</button> */}
    </React.Fragment>
  )
};

// Chat.defaultProps = {};

export default withStyles(styles)(Chat);
