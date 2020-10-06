
const iceServers = [
  {
      urls: "stun:stun.stunprotocol.org"
  }
  // currently no turn server
];


export default class WebRTCConnection {

  constructor({ target, sendFunc, offer, onMessage }) {
    this.msgChannel = null;
    this.sendFunc = sendFunc;
    this.onMessage = onMessage;
    this.target = target;
    
    this.rtcPeerConnection = new RTCPeerConnection(iceServers);

    this.rtcPeerConnection.addEventListener('icecandidate', (e) => {
      if (e.candidate) {
        const payload = {
          target,
          candidate: e.candidate,
        };
        
        this.send("webrtc:ice-candidate", payload);
      }
    });

    this.rtcPeerConnection.addEventListener('negotiationneeded', async () => {
      const offer = await this.rtcPeerConnection.createOffer();
      await this.rtcPeerConnection.setLocalDescription(offer);
      const payload = {
        target,
        sdp: this.rtcPeerConnection.localDescription
      };
      
      this.send("webrtc:offer", payload);
    });

    this.rtcPeerConnection.addEventListener('datachannel', (e) => {
      if(e.channel.label === 'msgChannel') {
        this.msgChannel = e.channel;
        this.msgChannel.addEventListener('message', this.handleMessage.bind(this));
      }
    });

    if(offer) {
      this.handleOffer(offer);
    }
    else {
      this.msgChannel = this.rtcPeerConnection.createDataChannel('msgChannel');
      this.msgChannel.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  async handleOffer(offer) {
    const desc = new RTCSessionDescription(offer.sdp);
    await this.rtcPeerConnection.setRemoteDescription(desc);
    const answer = await this.rtcPeerConnection.createAnswer();
    await this.rtcPeerConnection.setLocalDescription(answer);

    const payload = {
      target: offer.source,
      sdp: this.rtcPeerConnection.localDescription
    };
    
    this.send("webrtc:answer", payload);
  }

  addEventListener(type, handler) {
    return this.rtcPeerConnection.addEventListener(type, handler);
  }

  setRemoteDescription(sdp) {
    const desc = new RTCSessionDescription(sdp);
    this.rtcPeerConnection.setRemoteDescription(desc);
  }

  addIceCandidate(candidate) {
    const iceCandidate = new RTCIceCandidate(candidate);
    this.rtcPeerConnection.addIceCandidate(iceCandidate);
  }

  handleMessage(e) {
    if(this.onMessage) {
      const parsed = JSON.parse(e.data);
      const { type, ...data } = parsed;
      this.onMessage(type, { source: this.target, ...data });
    }
  }

  send(type, data) {
    if(this.msgChannel && this.msgChannel.readyState === 'open') {
      this.msgChannel.send(JSON.stringify({ type, ...data }));
    }
    else {
      this.sendFunc(type, data);
    }
  }
}
