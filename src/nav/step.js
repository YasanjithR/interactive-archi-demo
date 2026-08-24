/* The navigator answers one question — which node is active — and says when it
   changes. Nothing downstream knows or cares how the answer was reached. */
export class StepNavigator {
  constructor(nodes) {
    this.nodes = nodes;
    this.index = 0;
    this._subs = [];
  }
  get current() { return this.nodes[this.index]; }
  get atStart() { return this.index === 0; }
  get atEnd() { return this.index === this.nodes.length - 1; }

  onChange(cb) { this._subs.push(cb); return () => { this._subs = this._subs.filter(f => f !== cb); }; }

  indexOfId(id) { return this.nodes.findIndex(n => n.id === id); }

  go(i, cause = 'api') {
    const n = Math.max(0, Math.min(this.nodes.length - 1, i));
    if (n === this.index && cause !== 'init') return false;
    this.index = n;
    for (const cb of this._subs) cb(this.nodes[n], n, cause);
    return true;
  }
  goId(id, cause = 'api') { const i = this.indexOfId(id); return i < 0 ? false : this.go(i, cause); }
  next() { return this.go(this.index + 1, 'next'); }
  prev() { return this.go(this.index - 1, 'prev'); }
}
