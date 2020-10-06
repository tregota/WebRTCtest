import { useState, useCallback, useRef } from 'react';
import WebRTCConnection from '../classes/WebRTCConnection'



export default function useWebRTC(ws) {
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const [connections, setConnections] = useState({});
  const observers = useRef({});

  const connect = (target, offer) => {
    const connection = new WebRTCConnection({ 
      target,
      sendFunc: ws.send,
      offer,
      onMessage: (type, data) => { return type in observers.current ? observers.current[type](data) : null; }
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

    return connection;
  }

  ws.on("webrtc:offer", async (data) => {
    connect(data.source, data);
  });

  ws.on("webrtc:answer", async (data) => {
    if(data.source in connections) {
      await connections[data.source].setRemoteDescription(data.sdp);
    }
  });

  ws.on("webrtc:ice-candidate", async (data) => {
    if(data.source in connections) {
      await connections[data.source].addIceCandidate(data.candidate);
    }
  });

  return {
    connections,
    connect,
    on: (type, func) => observers.current[type] = func,
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