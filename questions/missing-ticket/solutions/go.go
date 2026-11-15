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
    n := int32(len(scans))
    // XOR of the log and of 1..n leaves duplicate ^ missing.
    var both int32
    for i := int32(0); i < n; i++ {
        both ^= scans[i] ^ (i + 1)
    }
    // Split every number on one bit where the two differ; each side isolates one of them.
    bit := both & -both
    var a int32
    for i := int32(0); i < n; i++ {
        if scans[i]&bit != 0 {
            a ^= scans[i]
        }
        if (i+1)&bit != 0 {
            a ^= i + 1
        }
    }
    b := both ^ a
    for _, v := range scans {
        if v == a {
            return []int32{a, b}
        }
    }
    return []int32{b, a}
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
