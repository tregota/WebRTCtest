import React, { useEffect, useRef, useState, useCallback } from 'react';
import { withStyles } from '@material-ui/core/styles';
import PersonRoundedIcon from '@material-ui/icons/PersonRounded';
import useWebSocket from '../../hooks/useWebSocket';
import useWebRTC from '../../hooks/useWebRTC';
import TextField from '@material-ui/core/TextField';
import Message from './Message'

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    "& > *": {
      padding: "20px"
    }
  },
  pageMain: {
    flexGrow: 1,
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
    overflow: "hidden"
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
  // const userVideo = useRef();
  const partnerVideo = useRef();
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
    setUsers(data.users);
    call(data.users);
  });
  ws.on("user:connect", (data) => {
    setUsers((users) => [...users, data.user]);
  });
  ws.on("user:disconnect", (data) => {
    setUsers((users) => users.filter(u => u.id !== data.id));
  });
  ws.on("user:rename", (data) => {
    setUsers((users) => [...users.filter(u => u.id !== data.user.id), data.user]);
  });
  ws.on("close", () => {
    writeToLog("websocket disconnected");
  });

  const wRTC = useWebRTC(ws, con => {
    con.addEventListener('track', (e) => {
      partnerVideo.current.srcObject = e.streams[0];
    })
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

  const test = async () => {
    writeToLog("test");
    userStream.current = await navigator.mediaDevices.getDisplayMedia({ cursor: true });
    for(const connection of Object.values(wRTC.connections)) {
      const senders = connection.getSenders();
      if(senders.length){
        if ("removeTrack" in connection) {
          connection.removeTrack(connection.getSenders()[0]);
        } else {
          connection.removeStream(userStream.current);
        }
      }
      connection.addStream(userStream.current);
    }


  }

  return (
    <div className={classes.wrapper}>
      { ws.isOpen() && users.length ? 
        <div className={classes.users}>
          {users.map((user, idx) => 
            <div className={user.id in wRTC.connections && wRTC.connections[user.id].connectionState === 'connected' ? classes.userConnected : classes.user} key={user.id}>
              <PersonRoundedIcon className={classes.userIcon} />
              {user.name || user.id}
            </div>)
          }
        </div>
        : undefined
      }
      <main className={classes.pageMain}>
        {/* <video style={{width: 500}} autoPlay ref={userVideo} />*/}
        <video style={{width: 500}} autoPlay ref={partnerVideo} /> 
      </main>
      <div className={classes.chat}>
        {chatLines.map((line, idx) => <Message key={idx} users={users} userId={line.userId} message={line.message} outgoing={line.userId==="me"} />)}
      </div>
      <TextField
          // className={classes.chatInput}
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
      <footer className={classes.pageFooter} ref={logElemRef}>
        {logLines.map((line, idx) => <div key={idx}>{line}</div>)}
        <button onClick={() => test()}>test</button>
      </footer>
    </div>
  )
};

// Chat.defaultProps = {};

export default withStyles(styles)(Chat);
