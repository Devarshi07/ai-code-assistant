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
 * Complete the 'courseOrder' function below.
 *
 * The function is expected to return a STRING.
 * The function accepts following parameters:
 *  1. INTEGER n
 *  2. 2D_INTEGER_ARRAY prerequisites
 */

func courseOrder(n int32, prerequisites [][]int32) string {
    // Kahn's algorithm with a min-heap: always take the smallest course whose
    // prerequisites are all finished.
    after := make([][]int32, n+1)
    waiting := make([]int32, n+1)
    for _, prereq := range prerequisites {
        after[prereq[0]] = append(after[prereq[0]], prereq[1])
        waiting[prereq[1]]++
    }
    ready := &courseHeap{}
    for course := int32(1); course <= n; course++ {
        if waiting[course] == 0 {
            heap.Push(ready, course)
        }
    }
    var order strings.Builder
    taken := int32(0)
    for ready.Len() > 0 {
        course := heap.Pop(ready).(int32)
        if taken > 0 {
            order.WriteByte(' ')
        }
        order.WriteString(strconv.Itoa(int(course)))
        taken++
        for _, next := range after[course] {
            waiting[next]--
            if waiting[next] == 0 {
                heap.Push(ready, next)
            }
        }
    }
    if taken < n {
        return "IMPOSSIBLE"
    }
    return order.String()
}

// courseHeap is a min-heap of course numbers.
type courseHeap []int32

func (h courseHeap) Len() int { return len(h) }
func (h courseHeap) Less(i, j int) bool { return h[i] < h[j] }
func (h courseHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *courseHeap) Push(x interface{}) { *h = append(*h, x.(int32)) }
func (h *courseHeap) Pop() interface{} {
    old := *h
    course := old[len(old)-1]
    *h = old[:len(old)-1]
    return course
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

    var prerequisites [][]int32
    for i := 0; i < int(m); i++ {
        prerequisitesRowTemp := strings.Split(strings.TrimRight(readLine(reader), " \t\r\n"), " ")

        var prerequisitesRow []int32
        for _, prerequisitesRowItem := range prerequisitesRowTemp {
            prerequisitesItemTemp, err := strconv.ParseInt(prerequisitesRowItem, 10, 64)
            checkError(err)
            prerequisitesItem := int32(prerequisitesItemTemp)
            prerequisitesRow = append(prerequisitesRow, prerequisitesItem)
        }

        if len(prerequisitesRow) != 2 {
            panic("Bad input")
        }

        prerequisites = append(prerequisites, prerequisitesRow)
    }

    result := courseOrder(n, prerequisites)

    fmt.Printf("%s\n", result)
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
