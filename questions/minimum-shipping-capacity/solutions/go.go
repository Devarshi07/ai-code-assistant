package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "strconv"
    "strings"
)

// Fewest days the truck needs with the given capacity (greedy loading).
func daysNeeded(weights []int32, capacity int) int {
    days, load := 1, 0
    for _, w := range weights {
        load += int(w)
        if load > capacity {
            days++
            load = int(w)
        }
    }
    return days
}

/*
 * Complete the 'minimumCapacity' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY weights
 *  2. INTEGER d
 */

func minimumCapacity(weights []int32, d int32) int32 {
    // Binary search on the answer between the heaviest package and the total weight.
    lo, hi := 0, 0
    for _, w := range weights {
        if int(w) > lo {
            lo = int(w)
        }
        hi += int(w)
    }
    for lo < hi {
        mid := lo + (hi-lo)/2
        if daysNeeded(weights, mid) <= int(d) {
            hi = mid
        } else {
            lo = mid + 1
        }
    }
    return int32(lo)
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    nTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    n := int32(nTemp)

    dTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    d := int32(dTemp)

    weightsTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var weights []int32

    for i := 0; i < int(n); i++ {
        weightsItemTemp, err := strconv.ParseInt(weightsTemp[i], 10, 64)
        checkError(err)
        weightsItem := int32(weightsItemTemp)
        weights = append(weights, weightsItem)
    }

    result := minimumCapacity(weights, d)

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
