const Hyperswarm = require('hyperswarm')
const Hyperbee = require('hyperbee')
const Corestore = require('corestore')
const goodbye = require('graceful-goodbye')
const EventEmitter = require('events')
const { v4: uuid } = require('uuid')

function decodeState (data) {
  data = data && data.value
    ? JSON.parse(data.value.toString())
    : null
  return data
}

function encodeState (data) {
  return Buffer.from(JSON.stringify(data))
}

class Meet extends EventEmitter {
  constructor (conf, store) {
    super()

    this.store = store
    this.conf = conf
    this.type = this.conf.type

    this.swarm0 = new Hyperswarm({
      firewall: conf.firewall
    })

    this.swarm1 = new Hyperswarm({
      firewall: conf.firewall
    })

    this._mem = {}
  }

  async _init () {
    const conf = this.conf

    const store = new Corestore(conf.storeDir)
    await store.ready()

    this.store = store

    const coreState = store.get({ name: 'db-state' })
    this.state = new Hyperbee(coreState)
  }

  async _onGossipData (cid, d) {
    if (!d) {
      return
    }

    d = d.toString()

    try {
      d = JSON.parse(d)
    } catch (e) {
      return
    }

    await this._onGossipData_0(cid, d)

    this.emit('debug', { type: 'gossip-data', data: d })
  }

  _onConnectReplicate (conn, info) {
    this.store.replicate(conn)

    conn.on('error', e => {
      this.emit('error', { type: 'repl', peerInfo: info, error: e })
    })
  }

  async _onConnectGossip (conn, info) {
    const cid = uuid()

    conn.on('data', d => {
      this._onGossipData(cid, d)
    })

    conn.on('error', e => {
      this.emit('error', { type: 'gossip', peerInfo: info, error: e })
    })

    if (this._onConnectGossip_0) {
      this._onConnectGossip_0(conn, info)
    }

    this.emit('peer-connected', info)
  }

  _error (e) {
    this.emit('error', e)
  }

  async _start () {
    const conf = this.conf

    await this.init()

    this.swarm0.on('connection', this._onConnectReplicate.bind(this))
    this.swarm1.on('connection', this._onConnectGossip.bind(this))
    this.swarm0.on('error', this._error.bind(this))
    this.swarm1.on('error', this._error.bind(this))

    const tk0 = Buffer.from(conf.topic, 'hex')
    const tk1 = Buffer.from(`${conf.topic}-gossip`.toString('hex'), 'hex')

    this.swarm0.join(tk0)
    this.swarm1.join(tk1)
  }

  async _stop () {
    this.swarm0.destroy()
    this.swarm1.destroy()
  }

  encodeState (data) {
    return encodeState(data)
  }

  decodeState (data) {
    return decodeState(data)
  }
}

module.exports = Meet
