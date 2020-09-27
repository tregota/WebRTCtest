import React, { useEffect, useRef, useState } from 'react';
import { withStyles } from '@material-ui/core/styles';
import PersonRoundedIcon from '@material-ui/icons/PersonRounded';
import useWebSocket from '../../hooks/useWebSocket';
import useWebRTC from '../../hooks/useWebRTC';
import { Call, PhoneInTalk } from '@material-ui/icons';

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
    padding: "4px",
    cursor: "pointer",
  },
  userIcon: {
    verticalAlign: "middle", 
    fontSize: "18px",
    marginTop: "-4px"
  },
  callIcon: {
    verticalAlign: "middle", 
    fontSize: "18px",
    float: "right"
  }
}

const Chat = ({classes}) => {
  const [users, setUsers] = useState([]);
  // logging
  const [logLines, setLogLines] = useState([]);
  const writeToLog = (text) => {
    setLogLines((output) => [...output, text]);
  }
  const logElemRef = useRef(null);
  useEffect(() => {
    logElemRef.current.scrollTop = logElemRef.current.scrollHeight;
  }, [logLines]);
  // webrtc stuff
  const userVideo = useRef();
  const partnerVideo = useRef();
  const userStream = useRef();

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

  const wRTC = useWebRTC(ws, (target, connection) => {
    connection.ondatachannel = (e) => {
      e.channel.onmessage = (e) => writeToLog(e.data);
      e.channel.onopen = () => {
        writeToLog("Incoming Data Channel Opened");
        e.channel.send("hej själv!");
      }
      e.channel.onclose = () => writeToLog("Incoming Data Channel Cloased");
    };
    connection.ontrack = (e, connection) => {
      partnerVideo.current.srcObject = e.streams[0];
    };
    // onOffer: (id, connection) => {
    //   userStream.current.getTracks().forEach(track => connection.addTrack(track, userStream.current));
    //   return true;
    // },
  });

  const call = async (userId) => {
    writeToLog('calling: ' + userId);
    const connection = wRTC.connect(userId);
    const sendChannel = connection.createDataChannel('sendDataChannel');
    sendChannel.onmessage = (e) => writeToLog(e.data);
    sendChannel.onopen = () => {
      writeToLog("Data Channel Opened");
      sendChannel.send("hej!");
    };
    sendChannel.onclose = () => writeToLog("Data Channel Closed");
    
    userStream.current && userStream.current.getTracks().forEach(track => connection.addTrack(track, userStream.current));
  }





  return (
    <div className={classes.wrapper}>
      { ws.isConnected && users.length ? 
        <div className={classes.users}>
          {users.map((user, idx) => 
            <div className={classes.user} key={user.id} onClick={() => call(user.id)}>
              <PersonRoundedIcon className={classes.userIcon} />
              {user.name || user.id}
              {user.id in wRTC.connections === false ? <Call className={classes.callIcon} /> : wRTC.connections[user.id].connectionState === "connected" ? <PhoneInTalk className={classes.callIcon} /> : "hej"}
            </div>)
          }
        </div>
        : undefined
      }
      <main className={classes.pageMain}>
        <video style={{width: 500}} autoPlay ref={userVideo} />
        <video style={{width: 500}} autoPlay ref={partnerVideo} />
      </main>
      <footer className={classes.pageFooter} ref={logElemRef}>
        {logLines.map((line, idx) => <div key={idx}>{line}</div>)}
      </footer>
    </div>
  )
};

// Chat.defaultProps = {};

export default withStyles(styles)(Chat);
