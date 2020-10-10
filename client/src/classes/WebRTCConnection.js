
const iceServers = [
  {
      urls: "stun:stun.stunprotocol.org"
  }
  // currently no turn server
];


export default class WebRTCConnection {

  constructor({ id, target, sendFunc, offer, onMessage, debug, onPassThrough }) {
    this.msgChannel = null;
    this.id = id;
    this.sendFunc = sendFunc;
    this.onMessage = onMessage;
    this.target = target;
    this.debug = debug;
    this.onPassThrough = onPassThrough;
    
    this.rawConnection = new RTCPeerConnection(iceServers);

    this.rawConnection.addEventListener('icecandidate', (e) => {
      if (e.candidate) {
        const payload = {
          target,
          candidate: e.candidate,
        };
        
        this.send("ice-candidate", payload);
      }
    });

    this.rawConnection.addEventListener('negotiationneeded', async () => {
      const offer = await this.rawConnection.createOffer();
      await this.rawConnection.setLocalDescription(offer);
      const payload = {
        target,
        sdp: this.rawConnection.localDescription
      };
      this.send("offer", payload);
    });

    this.rawConnection.addEventListener('datachannel', (e) => {
      if(e.channel.label === 'msgChannel') {
        this.msgChannel = e.channel;
        this.msgChannel.addEventListener('message', this.parseMessage.bind(this));
      }
    });

    if(offer) {
      this.handleOffer(offer);
    }
    else {
      this.msgChannel = this.rawConnection.createDataChannel('msgChannel');
      this.msgChannel.addEventListener('message', this.parseMessage.bind(this));
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
    
    this.send("answer", payload);
  }

  addEventListener(type, handler) {
    return this.rawConnection.addEventListener(type, handler);
  }

  setRemoteDescription(sdp) {
    const desc = new RTCSessionDescription(sdp);
    this.rawConnection.setRemoteDescription(desc);
  }

  addIceCandidate(candidate) {
    const iceCandidate = new RTCIceCandidate(candidate);
    this.rawConnection.addIceCandidate(iceCandidate);
  }

  parseMessage(e) {
    const parsed = JSON.parse(e.data);
    this.handleMessage(parsed)
  }

  handleMessage = (data) => {
    const { type } = data;

    this.debug && console.log('Message presumably from', this.target, data)

    if(this.id && data.target && data.target !== this.id) {
      if(this.onPassThrough) {
        this.onPassThrough(this.target, data.target, data)
      }
    }
    else if(type === "offer") {
      this.handleOffer(data);
    }
    else if(type === "answer") {
      this.setRemoteDescription(data.sdp);
    }
    else if(type === "ice-candidate") {
      console.log(data);
      this.addIceCandidate(data.candidate);
    }
    else if(this.onMessage) {
      this.onMessage(type, { ...data, source: this.target });
    }
  }

  send(type, data) {
    if(this.msgChannel && this.msgChannel.readyState === 'open') {
      this.debug && console.log('WebRTC to', this.target, JSON.stringify({ type, ...data }))
      this.msgChannel.send(JSON.stringify({ type, ...data }));
    }
    else {
      this.sendFunc(type, { ...data, type: 'webrtc:'+type });
    }
  }
}
