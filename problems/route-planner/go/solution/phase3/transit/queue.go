package transit

// stateQueue is a binary min-heap of search states in search order, driven by
// container/heap.
type stateQueue []*searchState

func (q stateQueue) Len() int           { return len(q) }
func (q stateQueue) Less(i, j int) bool { return q[i].before(q[j]) }
func (q stateQueue) Swap(i, j int)      { q[i], q[j] = q[j], q[i] }

func (q *stateQueue) Push(x any) { *q = append(*q, x.(*searchState)) }

func (q *stateQueue) Pop() any {
	old := *q
	last := old[len(old)-1]
	old[len(old)-1] = nil // drop the reference so the state can be collected
	*q = old[:len(old)-1]
	return last
}
