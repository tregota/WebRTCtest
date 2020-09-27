import { useState, useCallback } from 'react';

const iceServers = [
  {
      urls: "stun:stun.stunprotocol.org"
  }
  // currently no turn server
];

export default function useWebRTC(ws, onConnect) {
  const [, updateState] = useState();
  const forceUpdate = useCallback(() => updateState({}), []);
  const [connections, setConnections] = useState({});

  const connect = (target) => {
    const connection = new RTCPeerConnection({ iceServers });
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
      ws.send("webrtc:offer", payload);
    }

    connection.onconnectionstatechange = ev => {
      switch(connection.connectionState) {
        case "failed":
          console.log("connection failed", ev)
        case "disconnected":
        case "closed":
          setConnections( ({ [target]: omit, ...rest }) => rest);
          break;
        default:
          forceUpdate();
          break;
      }
    }

    if(onConnect) {
      onConnect(target, connection);
    }

    return connection;
  }

  ws.on("webrtc:offer", async (data) => {
    const connection = connect(data.source);
    setConnections(connections => ({ ...connections, [data.source]: connection }));

    const desc = new RTCSessionDescription(data.sdp);
    await connection.setRemoteDescription(desc);
   
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    const payload = {
      target: data.source,
      sdp: connection.localDescription
    }
    ws.send("webrtc:answer", payload);

  });

  ws.on("webrtc:answer", async (data) => {
    if(data.source in connections) {
      const desc = new RTCSessionDescription(data.sdp);
      await connections[data.source].setRemoteDescription(desc);
    }
  });

  ws.on("webrtc:ice-candidate", async (data) => {
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