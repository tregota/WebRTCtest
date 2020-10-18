import { useState, useCallback, useRef } from 'react';
import NegotiatingRTCConnection from '../classes/NegotiatingRTCConnection'



export default function useWebRTC(ws, { onConnection, debug, allowPassThrough }) {
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const [connections, setConnections] = useState({});
  const observers = useRef({});

  const connect = (target, offer) => {
    const connection = new NegotiatingRTCConnection({
      target,
      fallbackSend: (type, data) => ws.send('webrtc:'+type, { target, ...data }),
      offer,
      onMessage: (type, data) => {
        return type in observers.current ? observers.current[type](data) : null; 
      },
      debug,
      onPassThrough: allowPassThrough === true ? (data) => {
        if(data.target && data.target in connections) {
          connections[data.target].send(data.type, { ...data, source: target, route: [...data.route, target] });
          return true;
        }
        return false;
      } : undefined
    });
    setConnections(connections => ({ ...connections, [target]: connection }));

    connection.addEventListener('connectionstatechange', e => {
      debug && console.log('WebRTC connection to', target, connection.rtcConnection.connectionState);
      switch(connection.rtcConnection.connectionState) {
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

  ws.on(/^webrtc:/, data => {
    const type = data.type.substring(7); // remove "webrtc:" prefix
    if(data.source in connections) {
      connections[data.source].handleMessage({ ...data, type });
    }
    else if(type === 'offer') {
      connect(data.source, data);
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
    },
    close: (target) => {
      if(target in connections) {
        connections[target].rtcConnection.close()
        setConnections( ({ [target]: omit, ...rest }) => rest);
      }
    }
  }
}