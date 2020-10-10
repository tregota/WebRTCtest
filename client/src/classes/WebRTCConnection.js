
const iceServers = [
  {
      urls: "stun:stun.stunprotocol.org"
  }
  // currently no turn server
];


export default class WebRTCConnection {

  constructor({ target, sendFunc, offer, onMessage, debug, onPassThrough }) {
    this.msgChannel = null;
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

  parseMessage(e) {
    const parsed = JSON.parse(e.data);
    this.handleMessage(parsed)
  }

  handleMessage = (data) => {
    const { type } = data;

    this.debug && console.log('Message presumably from', this.target, data)

    // first check if this should be sent on
    if(!this.onPassThrough || !this.onPassThrough(data)) {
      if(type === "offer") {
        this.handleOffer(data);
      }
      else if(type === "answer") {
        const desc = new RTCSessionDescription(data.sdp);
        this.rawConnection.setRemoteDescription(desc);
      }
      else if(type === "ice-candidate") {
        const iceCandidate = new RTCIceCandidate(data.candidate);
        this.rawConnection.addIceCandidate(iceCandidate);
      }
      else if(this.onMessage) {
        this.onMessage(type, { ...data, source: this.target });
      }
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
