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
 * Complete the 'findDuplicateAndMissing' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY scans as parameter.
 */

func findDuplicateAndMissing(scans []int32) []int32 {
    // Write your code here
    return []int32{}
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    nTemp, err := strconv.ParseInt(strings.TrimSpace(readLine(reader)), 10, 64)
    checkError(err)
    n := int32(nTemp)

    scansTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var scans []int32

    for i := 0; i < int(n); i++ {
        scansItemTemp, err := strconv.ParseInt(scansTemp[i], 10, 64)
        checkError(err)
        scansItem := int32(scansItemTemp)
        scans = append(scans, scansItem)
    }

    result := findDuplicateAndMissing(scans)

    for i, resultItem := range result {
        fmt.Printf("%d", resultItem)

        if i != len(result) - 1 {
            fmt.Printf(" ")
        }
    }

    fmt.Printf("\n")
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
