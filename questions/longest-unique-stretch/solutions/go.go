package main

import (
    "bufio"
    "fmt"
    "io"
    "os"
    "strings"
)

/*
 * Complete the 'longestUniqueStretch' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts STRING s as parameter.
 */

func longestUniqueStretch(s string) []int32 {
    var last [128]int32 // most recent index of each character
    for c := range last {
        last[c] = -1
    }
    var left, bestLen, bestStart int32
    for i := int32(0); i < int32(len(s)); i++ {
        c := s[i]
        if last[c] >= left {
            left = last[c] + 1 // the window's left edge only ever moves forward
        }
        last[c] = i
        if i-left+1 > bestLen {
            bestLen = i - left + 1
            bestStart = left
        }
    }
    return []int32{bestLen, bestStart}
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    s := strings.TrimSpace(readLine(reader))

    result := longestUniqueStretch(s)

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
