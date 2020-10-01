import { useState, useCallback, useRef } from 'react';

const iceServers = [
  {
      urls: "stun:stun.stunprotocol.org"
  }
  // currently no turn server
];

export default function useWebRTC(ws) {
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const [connections, setConnections] = useState({});
  const observers = useRef({});

  const emitEvent = (type, source, data) => {
    if(source && type+':'+source in observers.current) {
      observers.current[type+':'+source]({...data, type, source});
      return true;
    }
    else if(type in observers.current) {
      observers.current[type]({...data, type, source});
      return true;
    }
    return false;
  }

  const connect = (target, incoming) => {
    const connection = new RTCPeerConnection({ iceServers });
    if(!incoming) {
      connection.msgChannel = connection.createDataChannel('msgChannel');
      connection.msgChannel.onmessage = (e) => {
        const parsed = JSON.parse(e.data);
        const { type, ...data } = parsed;
        if(!emitEvent(type, target, data)) {
          emitEvent('default', target, parsed)
        }
      }
    }
    else {
      connection.msgChannel = null;
    }

    setConnections(connections => ({ ...connections, [target]: connection }));

    connection.addEventListener('icecandidate', (e) => {
      if (e.candidate) {
        const payload = {
          target,
          candidate: e.candidate,
        }
        
        if(connection.msgChannel && connection.msgChannel.readyState === 'open') {
          connection.msgChannel.send(JSON.stringify({type: "webrtc:ice-candidate", ...payload}));
        }
        else {
          ws.send("webrtc:ice-candidate", payload);
        }
      }
    });

    connection.addEventListener('negotiationneeded', async () => {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const payload = {
        target,
        sdp: connection.localDescription
      };
      if(connection.msgChannel && connection.msgChannel.readyState === 'open') {
        connection.msgChannel.send(JSON.stringify({type: "webrtc:offer", ...payload}));
      }
      else {
        ws.send("webrtc:offer", payload);
      }
    });

    connection.addEventListener('connectionstatechange', e => {
      switch(connection.connectionState) {
        case "failed":
          console.log("connection failed", e)
          break;
        case "disconnected":
        case "closed":
          setConnections( ({ [target]: omit, ...rest }) => rest);
          break;
        default:
          forceUpdate();
          break;
      }
    });

    connection.addEventListener('datachannel', (e) => {
      if(e.channel.label === 'msgChannel') {
        connection.msgChannel = e.channel;
        connection.msgChannel.onmessage = (e) => {
          const parsed = JSON.parse(e.data);
          const { type, ...data } = parsed;
          if(!emitEvent(type, target, data)) {
            emitEvent('default', target, parsed)
          }
        };
      }
    });

    connection.addEventListener('track', e => emitEvent('track', target, { streams: e.streams }))

    return connection;
  }

  const makeAnswer = async (data) => {
    let connection = connections[data.source];
    if(!connection) {
      connection = connect(data.source, true);
      setConnections(connections => ({ ...connections, [data.source]: connection }));
    }

    const desc = new RTCSessionDescription(data.sdp);
    await connection.setRemoteDescription(desc);
   
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    return {
      target: data.source,
      sdp: connection.localDescription
    }
  };
  const onAnswer = async (data) => {
    if(data.source in connections) {
      const desc = new RTCSessionDescription(data.sdp);
      await connections[data.source].setRemoteDescription(desc);
    }
  }

  ws.on("webrtc:offer", async (data) => {
    const payload = await makeAnswer(data);
    ws.send("webrtc:answer", payload);
  });
  ws.on("webrtc:answer", onAnswer);
  ws.on("webrtc:ice-candidate", async (data) => {
    if(data.source in connections) {
      const candidate = new RTCIceCandidate(data.candidate);
      await connections[data.source].addIceCandidate(candidate);
    }
  });

  observers.current["webrtc:offer"] = async (data) => {
    const payload = await makeAnswer(data);
    connections[data.source].msgChannel.send(JSON.stringify({type: "webrtc:answer", ...payload}));
  };
  observers.current["webrtc:answer"] = onAnswer;
  observers.current["webrtc:ice-candidate"] = async (data) => {
    const candidate = new RTCIceCandidate(data.candidate);
    await connections[data.source].addIceCandidate(candidate);
  };

  return {
    connections,
    connect,
    on: (type, func) => observers.current[type] = func,
    onFrom: (type, source, func) => observers.current[type+':'+source] = func,
    send: (type, data, target = null) => {
      if(typeof data !== 'object' || data === null) {
        data = { data };
      }
      if(target) {
        if(target in connections && connections[target].msgChannel && connections[target].msgChannel.readyState === 'open') {
          connections[target].msgChannel.send(JSON.stringify({type, ...data}));
        }
      }
      else {
        for(const connection of Object.values(connections)) {
          if(connection.msgChannel && connection.msgChannel.readyState === 'open') {
            connection.msgChannel.send(JSON.stringify({type, ...data}));
          }
        }
      }
    }
  }
}