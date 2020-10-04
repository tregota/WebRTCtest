import { useRef } from 'react';
import useWebRTC from './useWebRTC';

export default function useMessaging(bus) {
  const observers = useRef({});
  const webRTC = useWebRTC(bus, (source, connection) => {
    addConnectionEventListeners(source, connection)
  });

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

  const addConnectionEventListeners = (source, connection) => {
    connection.addEventListener('connectionstatechange', e => {
      console.log("webrtc connection to ", source, connection.connectionState)
      switch(connection.connectionState) {
        case "disconnected":
        case "closed":
          console.log("do stuff here?")
          break;
      }
    });
    connection.addEventListener('datachannel', (e) => {
      if(e.channel.label === 'msgChannel') {
        connection.msgChannel = e.channel;
        connection.msgChannel.onmessage = (e) => {
          const parsed = JSON.parse(e.data);
          const { type, ...data } = parsed;
          if(!emitEvent(type, source, data)) {
            emitEvent('default', source, parsed)
          }
        };
      }
    });
    connection.addEventListener('track', e => emitEvent('track', source, { streams: e.streams }))
  }

  const connect = (target) => {
    const connection = webRTC.connect(target)
    connection.msgChannel = connection.createDataChannel('msgChannel');
    connection.msgChannel.onmessage = (e) => {
      const parsed = JSON.parse(e.data);
      const { type, ...data } = parsed;
      if(!emitEvent(type, target, data)) {
        emitEvent('default', target, parsed)
      }
    }

    addConnectionEventListeners(target, connection);
    return connection;
  }

  return {
    connections: webRTC.connections,
    connect: (target) => connect(target),
    on: (type, func) => observers.current[type] = func,
    onFrom: (type, source, func) => observers.current[type+':'+source] = func,
    send: (type, data, target = null) => {
      if(typeof data !== 'object' || data === null) {
        data = { data };
      }
      if(target) {
        if(target in webRTC.connections && webRTC.connections[target].msgChannel && webRTC.connections[target].msgChannel.readyState === 'open') {
          webRTC.connections[target].msgChannel.send(JSON.stringify({type, ...data}));
        }
      }
      else {
        for(const connection of Object.values(webRTC.connections)) {
          if(connection.msgChannel && connection.msgChannel.readyState === 'open') {
            connection.msgChannel.send(JSON.stringify({type, ...data}));
          }
        }
      }
    }
  }
}