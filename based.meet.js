const Based = require('./../hyper-cmd-lib-based/index')
const Meet = require('./meet')

class BasedMeet extends Meet {
  constructor (conf) {
    super(conf)
  }

  async init () {
    await this._init()

    const store = this.store

    const core = store.get({ name: 'db-gen' })
    await core.ready()

    const coreOut = store.get({ name: 'db-gen-out' })

    const base = new Based.Autobased(null, {
      type: this.conf.type,
      inputs: [core],
      localInput: core,
      localOutput: coreOut
    })

    this.base = base

    await this.addInput('0000', core, false)

    this.emit('init')
  }

  async _onGossipData_0 (cid, d) {
    const store = this.store

    switch (d.op) {
      case 'add-input':
        {
          d.value.forEach(async k => {
            const hc = store.get({ key: Buffer.from(k, 'hex') })
            await hc.ready()

            this.addInput(cid, hc)
          })
        }
        break
      case 'remove-input':
        {
          d.value.forEach(async (k) => {
            const hc = store.get({ key: Buffer.from(k, 'hex') })
            await hc.ready()

            this.removeInput(cid, hc)
          })
        }
        break
    }
  }

  async _onConnectGossip_0 (conn, info) {
    const store = this.store

    const core = store.get({ name: 'db-gen' })
    await core.ready()

    conn.write(JSON.stringify({
      op: 'add-input',
      value: [core.key.toString('hex')]
    }))
  }

  async addInput (cid, hc, proc = true) {
    const base = this.base
    const state = this.state

    const lk = hc.key.toString('hex')
    const mk = `inp-${lk}`

    if (this._mem[mk]) {
      return false
    }

    this._mem[mk] = { connId: cid }
    this._mem[cid] = { type: 'input', hcKey: hc.key }

    let group = await state.get('group')
    group = this.decodeState(group) || []

    if (group.indexOf(lk) === -1) {
      group.push(lk)
    }

    if (proc) {
      base.autobase.addInput(hc)
    }

    await state.put('group', this.encodeState(group))

    this.emit('input-add', lk)
  }

  async removeInput (cid, hc) {
    const base = this.base
    const state = this.state

    const lk = hc.key.toString('hex')
    const mk = `inp-${lk}`

    if (!this._mem[mk]) {
      return false
    }

    delete this._mem[mk]
    delete this._mem[cid]

    let group = await state.get('group')
    group = this.decodeState(group) || []

    if (group) {
      const iix = group.indexOf(lk)

      if (iix > -1) {
        group.splice(iix, 1)
      }
    }

    base.autobase.removeInput(hc)
    await state.put('group', this.encodeState(group))

    this.emit('input-remove', lk)
  }

  async start () {
    await this._start()

    const state = this.state
    let group = await state.get('group')
    group = this.decodeState(group) || []

    const store = this.store
    group.forEach(async (i) => {
      const hc = store.get({ key: Buffer.from(i, 'hex') })
      await hc.ready()
    })

    this.started = true
    this.emit('started')
  }

  async stop () {
    await this._stop()

    this.emit('stop')
  }
}

module.exports = BasedMeet
