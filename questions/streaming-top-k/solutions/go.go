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

/*
 * Complete the 'topTracks' function below.
 *
 * The function is expected to return a 2D_INTEGER_ARRAY.
 * The function accepts 2D_INTEGER_ARRAY events as parameter.
 */

func topTracks(events [][]int32) [][]int32 {
    // Each play pushes a fresh entry with the track's new play count, and entries
    // whose play count is out of date are discarded when they surface.
    plays := make(map[int32]int32)
    leaders := &trackHeap{}
    answers := [][]int32{}
    for _, event := range events {
        kind, value := event[0], event[1]
        if kind == 1 {
            plays[value]++
            heap.Push(leaders, trackEntry{plays[value], value})
        } else {
            var top []trackEntry
            for leaders.Len() > 0 && int32(len(top)) < value {
                entry := heap.Pop(leaders).(trackEntry)
                if plays[entry.id] == entry.plays {
                    top = append(top, entry)
                }
            }
            ids := []int32{}
            for _, entry := range top {
                heap.Push(leaders, entry)
                ids = append(ids, entry.id)
            }
            answers = append(answers, ids)
        }
    }
    return answers
}

type trackEntry struct {
    plays, id int32
}

// trackHeap puts the entry with the most plays first, then the smaller track id.
type trackHeap []trackEntry

func (h trackHeap) Len() int { return len(h) }
func (h trackHeap) Less(i, j int) bool {
    if h[i].plays != h[j].plays {
        return h[i].plays > h[j].plays
    }
    return h[i].id < h[j].id
}
func (h trackHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *trackHeap) Push(x interface{}) { *h = append(*h, x.(trackEntry)) }
func (h *trackHeap) Pop() interface{} {
    old := *h
    entry := old[len(old)-1]
    *h = old[:len(old)-1]
    return entry
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)
    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    qTemp, err := strconv.ParseInt(strings.TrimSpace(readLine(reader)), 10, 64)
    checkError(err)
    q := int32(qTemp)

    var events [][]int32
    for i := 0; i < int(q); i++ {
        eventsRowTemp := strings.Split(strings.TrimRight(readLine(reader), " \t\r\n"), " ")

        var eventsRow []int32
        for _, eventsRowItem := range eventsRowTemp {
            eventsItemTemp, err := strconv.ParseInt(eventsRowItem, 10, 64)
            checkError(err)
            eventsItem := int32(eventsItemTemp)
            eventsRow = append(eventsRow, eventsItem)
        }

        if len(eventsRow) != 2 {
            panic("Bad input")
        }

        events = append(events, eventsRow)
    }

    result := topTracks(events)

    for _, resultRow := range result {
        for j, resultColumnItem := range resultRow {
            fmt.Fprintf(writer, "%d", resultColumnItem)

            if j != len(resultRow) - 1 {
                fmt.Fprintf(writer, " ")
            }
        }

        fmt.Fprintf(writer, "\n")
    }

    writer.Flush()
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
