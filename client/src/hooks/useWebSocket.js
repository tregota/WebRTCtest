import { useEffect, useRef, useState } from 'react';

export default function useWebSocket({ 
  url, 
  protocols, 
  keepAlive = false, // Send "pings" every 20 seconds. Server must support fake pings. Also checks that server is still there.
}) {
  const [isConnected, setConnected] = useState(false);
  const webSocket = useRef();
  const observers = useRef({});

  const send = (msg) => {
    if(webSocket.current === null) {
      throw new Error("Not Connected");
    }
    webSocket.current.send(msg); 
  }

  const emitEvent = (type, source, data) => {
    if(source && type+':'+source in observers.current) {
      observers.current[type+':'+source](data);
      return true;
    }
    else if(type in observers.current) {
      observers.current[type](data);
      return true;
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
      setConnected(true)
      isAlive = true;
      
      if(keepAlive) {
        pingTimer = 0;
        keepAliveInterval = setInterval(() => {
          if (isAlive === false) {
            return webSocket.current.close();
          }
          if(pingTimer >= 10) {
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
    };
  
    webSocket.current.onmessage = async (event) => {
      try {
        // since I cant find a way of handing an actual pong via the WebSocket API:
        if(event.data === 'pong') {
          isAlive = true;
          return;
        }

        if('message' in observers.current) {
          observers.current.message(event);
        }

        const parsed = JSON.parse(event.data);
        const { type, ...data } = parsed;

        if(!emitEvent(type, data.source, data)) {
          emitEvent('default', data.source, parsed)
        }
      }
      catch(e) {
        console.error(e);
      }
    };

    webSocket.current.onclose = () => {
      setConnected(false);
      webSocket.current = null;

      if(keepAliveInterval !== null) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }

      emitEvent('close');
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
  }, [keepAlive, protocols, url]);

  return {
    send: (type, payload) => send(JSON.stringify({ type, ...payload })),
    close: () => {
      return webSocket.current.close();
    },
    on: (type, func) => observers.current[type] = func,
    onFrom: (type, source, func) => observers.current[type+':'+source] = func,
    isConnected
  }
}