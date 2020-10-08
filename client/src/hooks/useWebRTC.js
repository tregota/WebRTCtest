import { useState, useCallback, useRef } from 'react';
import WebRTCConnection from '../classes/WebRTCConnection'



export default function useWebRTC(ws, onConnection) {
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const [connections, setConnections] = useState({});
  const observers = useRef({});

  const connect = (target, offer) => {
    const connection = new WebRTCConnection({ 
      target,
      sendFunc: (type, data) => ws.send(type, { ...data, target }),
      offer,
      onMessage: (type, data) => {
        return type in observers.current ? observers.current[type](data) : null; 
      },
    });
    setConnections(connections => ({ ...connections, [target]: connection }));

    connection.addEventListener('connectionstatechange', e => {
      switch(connection.connectionState) {
        case "failed":
        case "disconnected":
        case "closed":
          setConnections( ({ [target]: omit, ...rest }) => rest);
          break;
        default:
          forceUpdate();
          break;
      }
    });

    onConnection(connection);
  }

  ws.on("webrtc:offer", (data) => {
    connect(data.source, data);
  });

  ws.on("webrtc:answer", (data) => {
    if(data.source in connections) {
      connections[data.source].setRemoteDescription(data.sdp);
    }
  });

  ws.on("webrtc:ice-candidate", (data) => {
    if(data.source in connections) {
      connections[data.source].addIceCandidate(data.candidate);
    }
  });

  return {
    connections,
    connect,
    on: (type, func) => {
      observers.current[type] = func;
      ws.on(type, func);
    },
    send: (type, data, target = null) => {
      if(typeof data !== 'object' || data === null) {
        data = { data };
      }
      if(target) {
        if(target in connections) {
          connections[target].send(type, data);
        }
      }
      else {
        for(const connection of Object.values(connections)) {
          connection.send(type, data);
        }
      }
    }
  }
}