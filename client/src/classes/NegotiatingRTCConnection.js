
const iceServers = [
  {
      urls: "stun:stun.stunprotocol.org"
  }
  // currently no turn server
];


export default class NegotiatingRTCConnection {

  constructor({ target, fallbackSend, offer, onMessage, debug, onPassThrough }) {
    this.msgChannel = null;
    this.fallbackSend = fallbackSend;
    this.onMessage = onMessage;
    this.target = target;
    this.debug = debug;
    this.onPassThrough = onPassThrough;
    
    this.rtcConnection = new RTCPeerConnection(iceServers);

    this.rtcConnection.addEventListener('icecandidate', (e) => {
      if (e.candidate) {
        const payload = {
          candidate: e.candidate,
        };
        
        this.send("ice-candidate", payload);
      }
    });

    this.rtcConnection.addEventListener('negotiationneeded', async () => {
      const offer = await this.rtcConnection.createOffer();
      await this.rtcConnection.setLocalDescription(offer);
      const payload = {
        sdp: this.rtcConnection.localDescription
      };
      this.send("offer", payload);
    });

    this.rtcConnection.addEventListener('datachannel', (e) => {
      if(e.channel.label === 'msgChannel') {
        this.msgChannel = e.channel;
        this.msgChannel.addEventListener('message', this.parseMessage.bind(this));
      }
    });

    if(offer) {
      this.handleOffer(offer);
    }
    else {
      this.msgChannel = this.rtcConnection.createDataChannel('msgChannel');
      this.msgChannel.addEventListener('message', this.parseMessage.bind(this));
    }
  }

  async handleOffer(offer) {
    const desc = new RTCSessionDescription(offer.sdp);
    await this.rtcConnection.setRemoteDescription(desc);
    const answer = await this.rtcConnection.createAnswer();
    await this.rtcConnection.setLocalDescription(answer);

    const payload = {
      sdp: this.rtcConnection.localDescription
    };
    
    this.send("answer", payload);
  }

  addEventListener(type, handler) {
    return this.rtcConnection.addEventListener(type, handler);
  }

  parseMessage(e) {
    const parsed = JSON.parse(e.data);
    this.handleMessage(parsed)
  }

  handleMessage = (data) => {
    const { type } = data;

    this.debug && console.log('Message from', this.target, data)

    // first check if this should be sent on
    if(!this.onPassThrough || !this.onPassThrough(data)) {
      if(type === "offer") {
        this.handleOffer(data);
      }
      else if(type === "answer") {
        const desc = new RTCSessionDescription(data.sdp);
        this.rtcConnection.setRemoteDescription(desc);
      }
      else if(type === "ice-candidate") {
        const iceCandidate = new RTCIceCandidate(data.candidate);
        this.rtcConnection.addIceCandidate(iceCandidate);
      }
      else if(this.onMessage) {
        this.onMessage(type, { source: this.target, ...data });
      }
    }
  }

  send(type, data) {
    if(this.msgChannel && this.msgChannel.readyState === 'open') {
      this.debug && console.log('WebRTC to', this.target, JSON.stringify({ type, ...data }))
      this.msgChannel.send(JSON.stringify({ type, ...data }));
    }
    else {
      this.fallbackSend(type, { target: this.target, ...data });
    }
  }
}
