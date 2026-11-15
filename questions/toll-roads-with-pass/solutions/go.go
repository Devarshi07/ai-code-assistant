package main

import (
    "bufio"
    "container/heap"
    "fmt"
    "io"
    "os"
    "strconv"
    "strings"
)

type entry struct {
    dist  int64
    state int
}

// minHeap is a priority queue of (distance, state) pairs.
type minHeap []entry

func (h minHeap) Len() int            { return len(h) }
func (h minHeap) Less(i, j int) bool  { return h[i].dist < h[j].dist }
func (h minHeap) Swap(i, j int)       { h[i], h[j] = h[j], h[i] }
func (h *minHeap) Push(x interface{}) { *h = append(*h, x.(entry)) }
func (h *minHeap) Pop() interface{} {
    old := *h
    x := old[len(old)-1]
    *h = old[:len(old)-1]
    return x
}

type edge struct {
    to   int
    cost int64
}

/*
 * Complete the 'cheapestTrip' function below.
 *
 * The function is expected to return a LONG_INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER n
 *  2. 2D_INTEGER_ARRAY roads
 */

func cheapestTrip(n int32, roads [][]int32) int64 {
    towns := int(n)
    adj := make([][]edge, towns+1)
    for _, r := range roads {
        u, v, c := int(r[0]), int(r[1]), int64(r[2])
        adj[u] = append(adj[u], edge{v, c})
        adj[v] = append(adj[v], edge{u, c})
    }

    // Dijkstra over states (town, pass used?), encoded as 2 * town + used.
    const inf = int64(1) << 62
    dist := make([]int64, 2*towns+2)
    for i := range dist {
        dist[i] = inf
    }
    dist[2] = 0
    h := &minHeap{{0, 2}}
    for h.Len() > 0 {
        top := heap.Pop(h).(entry)
        d, state := top.dist, top.state
        if d > dist[state] {
            continue
        }
        town, used := state>>1, state&1
        // The first state of town n to leave the heap is the cheapest one.
        if town == towns {
            return d
        }
        for _, e := range adj[town] {
            target := 2*e.to + used
            if d+e.cost < dist[target] {
                dist[target] = d + e.cost
                heap.Push(h, entry{dist[target], target})
            }
            if used == 0 {
                target = 2*e.to + 1
                if d+e.cost/2 < dist[target] {
                    dist[target] = d + e.cost/2
                    heap.Push(h, entry{dist[target], target})
                }
            }
        }
    }
    return -1
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    nTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    n := int32(nTemp)

    mTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    m := int32(mTemp)

    var roads [][]int32
    for i := 0; i < int(m); i++ {
        roadsRowTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

        var roadsRow []int32
        for _, roadsRowItem := range roadsRowTemp {
            roadsItemTemp, err := strconv.ParseInt(roadsRowItem, 10, 64)
            checkError(err)
            roadsItem := int32(roadsItemTemp)
            roadsRow = append(roadsRow, roadsItem)
        }

        if len(roadsRow) != 3 {
            panic("Bad input")
        }

        roads = append(roads, roadsRow)
    }

    result := cheapestTrip(n, roads)

    fmt.Printf("%d\n", result)
}

func readLine(reader *bufio.Reader) string {
    str, _, err := reader.ReadLine()
    if err == io.EOF {
        return ""
    }

    return strings.TrimRight(string(str), "\r\n")
}

func checkError(err error) {
    if err != nil {
        panic(err)
    }
}
