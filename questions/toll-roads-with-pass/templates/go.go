package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "strconv"
    "strings"
)

/*
 * Complete the 'cheapestTrip' function below.
 *
 * The function is expected to return a LONG_INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER n
 *  2. 2D_INTEGER_ARRAY roads
 */

func cheapestTrip(n int32, roads [][]int32) int64 {
    // Write your code here
    return 0
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
