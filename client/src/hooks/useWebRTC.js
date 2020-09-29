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
      observers.current[type+':'+source]({type, data, source});
      return true;
    }
    else if(type in observers.current) {
      observers.current[type]({type, data, source});
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
        const { type, data } = parsed;
        if(!emitEvent(type, target, data)) {
          emitEvent('default', target, parsed)
        }
      }
      connection.send = (type, data) => connection.msgChannel.send(JSON.stringify({type, data}));
    }
    else {
      connection.msgChannel = null;
    }

    setConnections(connections => ({ ...connections, [target]: connection }));

    connection.onicecandidate = (e) => {
      if (e.candidate) {
        const payload = {
          target,
          candidate: e.candidate,
        }
        ws.send("webrtc:ice-candidate", payload);
      }
    };

    connection.onnegotiationneeded = async () => {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const payload = {
        target,
        sdp: connection.localDescription
      };
      if(connection.msgChannel && connection.msgChannel.readyState === 'open') {
        connection.send("webrtc:offer", payload);
      }
      else {
        ws.send("webrtc:offer", payload);
      }
    }

    connection.onconnectionstatechange = ev => {
      console.log("connection to", target, connection.connectionState)
      switch(connection.connectionState) {
        case "failed":
          console.log("connection failed", ev)
          break;
        case "disconnected":
        case "closed":
          setConnections( ({ [target]: omit, ...rest }) => rest);
          break;
        default:
          forceUpdate();
          break;
      }
    }

    connection.addEventListener('datachannel', (e) => {
      if(e.channel.label === 'msgChannel') {
        connection.msgChannel = e.channel;
        connection.msgChannel.onmessage = (e) => {
          const parsed = JSON.parse(e.data);
          const { type, data } = parsed;
          if(!emitEvent(type, target, data)) {
            emitEvent('default', target, parsed)
          }
        };
        connection.send = (type, data) => connection.msgChannel.send(JSON.stringify({type, data}));
      }
    });

    return connection;
  }

  const makeAnswer = async (data) => {
    const connection = connect(data.source, true);
    setConnections(connections => ({ ...connections, [data.source]: connection }));

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
    connections[data.source].send("webrtc:answer", payload);
  };
  observers.current["webrtc:answer"] = onAnswer;

  return {
    connections,
    connect,
    on: (type, func) => observers.current[type] = func,
    onFrom: (type, source, func) => observers.current[type+':'+source] = func,
    send: (type, data, target = null) => {
      if(target) {
        if(target in connections && connections[target].msgChannel && connections[target].msgChannel.readyState === 'open') {
          connections[target].send(type, data);
        }
      }
      else {
        for(const connection of Object.values(connections)) {
          if(connection.msgChannel && connection.msgChannel.readyState === 'open') {
            connection.send(type, data);
          }
        }
      }
    }
  }
}