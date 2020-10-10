import { useEffect, useRef, useState, useCallback } from 'react';

export default function useWebSocket({ 
  url, 
  protocols, 
  keepAlive = false, // Send "pings" every 20 seconds. Server must support fake pings. Also checks that server is still there.
  debug
}) {
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const webSocket = useRef();
  const observers = useRef({});
  const patternObservers = useRef({});

  const send = (msg) => {
    if(webSocket.current === null) {
      return false;
    }
    debug && msg !== 'ping' && console.log('WebSocket sending', msg)
    webSocket.current.send(msg); 
    return true;
  }

  const emitEvent = (type, data) => {
    if(type in observers.current) {
      observers.current[type](data);
      return true;
    }

    for (const [regex, func] of Object.values(patternObservers.current)) {
      if (type.match(regex)) {
        func(data);
        return true;
      }
    }

    return false;
  }

  useEffect(() => {
    let keepAliveInterval = null;
    let isAlive = null;
    let pingTimer = null;

    if(!url) {
      throw new Error("useWebSocket prop url is missing!")
    }

    webSocket.current = new WebSocket(url, protocols);
  
    webSocket.current.onopen = () => {
      isAlive = true;
      
      if(keepAlive) {
        pingTimer = 0;
        keepAliveInterval = setInterval(() => {
          if (isAlive === false) {
            return webSocket.current.close();
          }
          if(pingTimer >= 10) {
            pingTimer = 0;
            // since I cant find a way of sending an actual ping via the WebSocket API:
            isAlive = false;
            send("ping"); 
          }
          else {
            pingTimer++;
          }
        }, 2000);
      }

      emitEvent('open');
      forceUpdate();
    };
  
    webSocket.current.onmessage = async (event) => {
      try {
        // since I cant find a way of handing an actual pong via the WebSocket API:
        if(event.data === 'pong') {
          isAlive = true;
          return;
        }

        debug && console.log('WebSocket received', event.data)

        const data = JSON.parse(event.data);

        if(!emitEvent(data.type, data)) {
          emitEvent('default', data)
        }
      }
      catch(e) {
        console.error(e);
      }
    };

    webSocket.current.onclose = () => {
      webSocket.current = null;

      if(keepAliveInterval !== null) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }

      emitEvent('close');
      forceUpdate();
    };
  
    webSocket.current.onerror = (e) => emitEvent('error', undefined, e);

    return () => {
      if(keepAliveInterval !== null) {
        clearInterval(keepAliveInterval);
      }
      if(webSocket.current) {
        webSocket.current.close();
      }
    }
  }, [keepAlive, protocols, url, forceUpdate]);

  return {
    send: (type, payload) => send( payload ? JSON.stringify({ type, ...payload }) : type ),
    close: () => {
      return webSocket.current.close();
    },
    on: (type, func) => {
      if(Object.prototype.toString.call(type) === '[object RegExp]') {
        patternObservers.current[type] = [type, func];
      }
      else {
        observers.current[type] = func;
      }
    },
    isOpen: () => webSocket.current && webSocket.current.readyState === 1
  }
}