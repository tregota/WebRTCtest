import { useState, useEffect, useRef, useCallback, Component } from 'react';

const iceServers = [
  {
      urls: "stun:stun.stunprotocol.org"
  }
  // currently no turn server
];

export default function useWebRTCConnection(ws, target, onConnect) {
  const [connectionState, setConnectionState] = useState();
  const _connection = useRef(null);

  useEffect(() => {

    const connection = new RTCPeerConnection({ iceServers });
    _connection.current = connection;

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

    connection.onconnectionstatechange = () => setConnectionState(connection.connectionState);

    if(onConnect) {
      onConnect(target, connection);
    }

  }, [target]);

men om man inte vet om användaren än? då måaste man ha en generell event-hanterare och sen lämna connection till en ny Component.. det här var kanske inte vettigt

  ws.onFrom("webrtc:offer", target, async (data) => {
    const connection = connect(data.source);
    _connection.current = connection;

    const desc = new RTCSessionDescription(data.sdp);
    await connection.setRemoteDescription(desc);

    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    const payload = {
      target,
      sdp: connection.localDescription
    }
    ws.send("webrtc:answer", payload);
  });

  ws.onFrom("webrtc:answer", target, async (data) => {
    if(data.source in connections) {
      const desc = new RTCSessionDescription(data.sdp);
      await connections[data.source].setRemoteDescription(desc);
    }
  });

  ws.onFrom("webrtc:ice-candidate", target, async (data) => {
    if(data.source in connections) {
      const candidate = new RTCIceCandidate(data.candidate);
      await connections[data.source].addIceCandidate(candidate);
    }
  });

  return {
    connectionState,
    connection: connection
  }
}