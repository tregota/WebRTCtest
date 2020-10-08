
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
    
    this.rawConnection = new RTCPeerConnection(iceServers);

    this.rawConnection.addEventListener('icecandidate', (e) => {
      if (e.candidate) {
        const payload = {
          target,
          candidate: e.candidate,
        };
        
        this.send("webrtc:ice-candidate", payload);
      }
    });

    this.rawConnection.addEventListener('negotiationneeded', async () => {
      const offer = await this.rawConnection.createOffer();
      await this.rawConnection.setLocalDescription(offer);
      const payload = {
        target,
        sdp: this.rawConnection.localDescription
      };
      this.send("webrtc:offer", payload);
    });

    this.rawConnection.addEventListener('datachannel', (e) => {
      if(e.channel.label === 'msgChannel') {
        this.msgChannel = e.channel;
        this.msgChannel.addEventListener('message', this.handleMessage.bind(this));
      }
    });

    if(offer) {
      this.handleOffer(offer);
    }
    else {
      this.msgChannel = this.rawConnection.createDataChannel('msgChannel');
      this.msgChannel.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  async handleOffer(offer) {
    const desc = new RTCSessionDescription(offer.sdp);
    await this.rawConnection.setRemoteDescription(desc);
    const answer = await this.rawConnection.createAnswer();
    await this.rawConnection.setLocalDescription(answer);

    const payload = {
      target: offer.source,
      sdp: this.rawConnection.localDescription
    };
    
    this.send("webrtc:answer", payload);
  }

  addEventListener(type, handler) {
    return this.rawConnection.addEventListener(type, handler);
  }

  getSenders() {
    return this.rawConnection.getSenders();
  }

  addStream(stream) {
    return this.rawConnection.addStream(stream);
  }

  setRemoteDescription(sdp) {
    const desc = new RTCSessionDescription(sdp);
    this.rawConnection.setRemoteDescription(desc);
  }

  addIceCandidate(candidate) {
    const iceCandidate = new RTCIceCandidate(candidate);
    this.rawConnection.addIceCandidate(iceCandidate);
  }

  handleMessage(e) {
    const parsed = JSON.parse(e.data);
    const { type, ...data } = parsed;

    if(type === "webrtc:offer") {
      this.handleOffer(data);
    }
    else if(type === "webrtc:answer") {
      this.setRemoteDescription(data.sdp);
    }
    else if(type === "webrtc:ice-candidate") {
      this.addIceCandidate(data.candidate);
    }
    else if(this.onMessage) {
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
