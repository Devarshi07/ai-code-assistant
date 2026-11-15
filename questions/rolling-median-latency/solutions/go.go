package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "strconv"
    "strings"
)

// minHeap is a binary min-heap of int64 keys.
type minHeap []int64

func (h *minHeap) push(x int64) {
    a := append(*h, x)
    i := len(a) - 1
    for i > 0 {
        p := (i - 1) / 2
        if a[p] <= x {
            break
        }
        a[i] = a[p]
        i = p
    }
    a[i] = x
    *h = a
}

func (h *minHeap) pop() int64 {
    a := *h
    top := a[0]
    last := a[len(a)-1]
    a = a[:len(a)-1]
    n := len(a)
    if n > 0 {
        i := 0
        for {
            c := 2*i + 1
            if c >= n {
                break
            }
            if c+1 < n && a[c+1] < a[c] {
                c++
            }
            if a[c] >= last {
                break
            }
            a[i] = a[c]
            i = c
        }
        a[i] = last
    }
    *h = a
    return top
}

/*
 * Complete the 'rollingMedian' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY latency
 *  2. INTEGER k
 */

func rollingMedian(latency []int32, k int32) []int32 {
    // lo (a max-heap, stored negated) holds the smaller ceil(size / 2) values of
    // the window and hi the rest, so the lower median is the top of lo. A key
    // packs (value, index) into one int64, unique per element; entries that left
    // the window are discarded lazily when they reach a heap's top.
    const shift = 17
    const mask = int64(1)<<shift - 1
    n := len(latency)
    w := int(k)
    keys := make([]int64, n)
    for i, v := range latency {
        keys[i] = int64(v)<<shift | int64(i)
    }
    lo, hi := &minHeap{}, &minHeap{}
    loSize, hiSize := 0, 0
    medians := make([]int32, 0, n-w+1)
    for i := 0; i < n; i++ {
        start := int64(i - w + 1)
        if i >= w {
            if keys[i-w] <= -(*lo)[0] {
                loSize--
            } else {
                hiSize--
            }
        }
        for len(*lo) > 0 && (-(*lo)[0])&mask < start {
            lo.pop()
        }
        if len(*lo) > 0 && keys[i] < -(*lo)[0] {
            lo.push(-keys[i])
            loSize++
        } else {
            hi.push(keys[i])
            hiSize++
        }
        if loSize > hiSize+1 {
            for (-(*lo)[0])&mask < start {
                lo.pop()
            }
            hi.push(-lo.pop())
            loSize--
            hiSize++
        } else if loSize < hiSize {
            for (*hi)[0]&mask < start {
                hi.pop()
            }
            lo.push(-hi.pop())
            loSize++
            hiSize--
        }
        if start >= 0 {
            for (-(*lo)[0])&mask < start {
                lo.pop()
            }
            medians = append(medians, int32(-(*lo)[0]>>shift))
        }
    }
    return medians
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)
    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    nTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    n := int32(nTemp)

    kTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    k := int32(kTemp)

    latencyTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var latency []int32

    for i := 0; i < int(n); i++ {
        latencyItemTemp, err := strconv.ParseInt(latencyTemp[i], 10, 64)
        checkError(err)
        latencyItem := int32(latencyItemTemp)
        latency = append(latency, latencyItem)
    }

    result := rollingMedian(latency, k)

    for i, resultItem := range result {
        fmt.Fprintf(writer, "%d", resultItem)

        if i != len(result) - 1 {
            fmt.Fprintf(writer, " ")
        }
    }

    fmt.Fprintf(writer, "\n")

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
