import React, { useEffect, useRef, useState } from 'react';
import { withStyles } from '@material-ui/core/styles';
import useWebRTC from '../../hooks/useWebRTC';

const styles = {
  wrapper: {

  },
}

const Peer = ({classes}) => {
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
  const peerRef = useRef();
  const userVideo = useRef();
  const partnerVideo = useRef();
  const userStream = useRef();
  const senders = useRef([]);

  let room = window.location.pathname.substring(1);
  if(!room) {
    room = "lobby"
  }

  const ws = useWebSocket({
    url: `ws://${window.location.hostname}:5000/${room}${window.location.search}`,
    keepAlive: 20
  })


  return (
    <div className={classes.wrapper}>

    </div>
  )

};

export default withStyles(styles)(Peer);
