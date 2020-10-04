import { useState, useCallback, useRef, useEffect } from 'react';

const iceServers = [
  {
      urls: "stun:stun.stunprotocol.org"
  }
  // currently no turn server
];

export default function useWebRTC(bus = { on: () => {}, send: () => {} }, onIncomingConnection) {
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const [connections, setConnections] = useState({});


  const connect = (target) => {
    const connection = new RTCPeerConnection({ iceServers });
    setConnections(connections => ({ ...connections, [target]: connection }));

    connection.addEventListener('icecandidate', (e) => {
      if (e.candidate) {
        const payload = {
          target,
          candidate: e.candidate,
        }
        bus.send("webrtc:ice-candidate", payload);
      }
    });

    connection.addEventListener('negotiationneeded', async () => {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const payload = {
        target,
        sdp: connection.localDescription
      };
      bus.send("webrtc:offer", payload);
    });

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

  bus.on("webrtc:offer", async (data) => {
    let connection = connections[data.source];
    if(!connection) {
      connection = connect(data.source);
      setConnections(connections => ({ ...connections, [data.source]: connection }));
      if(onIncomingConnection) {
        onIncomingConnection(data.source, connection);
      }
    }

    const desc = new RTCSessionDescription(data.sdp);
    await connection.setRemoteDescription(desc);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    const payload = {
      target: data.source,
      sdp: connection.localDescription
    }
    bus.send("webrtc:answer", payload);
  });

  bus.on("webrtc:answer", async (data) => {
    if(data.source in connections) {
      const desc = new RTCSessionDescription(data.sdp);
      await connections[data.source].setRemoteDescription(desc);
    }
  });

  bus.on("webrtc:ice-candidate", async (data) => {
    if(data.source in connections) {
      const candidate = new RTCIceCandidate(data.candidate);
      await connections[data.source].addIceCandidate(candidate);
    }
  });

  return {
    connections,
    connect
  }
}