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
 * Complete the 'badgeScores' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY scores
 *  2. INTEGER m
 *  3. INTEGER g
 *  4. INTEGER t
 */

func badgeScores(scores []int32, m int32, g int32, t int32) []int32 {
    result := make([]int32, len(scores))
    for i, s := range scores {
        c := (int64(s) + int64(m) - 1) / int64(m) * int64(m)
        if s >= t && c-int64(s) < int64(g) {
            result[i] = int32(c)
        } else {
            result[i] = s
        }
    }
    return result
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)
    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    nTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    n := int32(nTemp)

    mTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    m := int32(mTemp)

    gTemp, err := strconv.ParseInt(firstMultipleInput[2], 10, 64)
    checkError(err)
    g := int32(gTemp)

    tTemp, err := strconv.ParseInt(firstMultipleInput[3], 10, 64)
    checkError(err)
    t := int32(tTemp)

    scoresTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var scores []int32

    for i := 0; i < int(n); i++ {
        scoresItemTemp, err := strconv.ParseInt(scoresTemp[i], 10, 64)
        checkError(err)
        scoresItem := int32(scoresItemTemp)
        scores = append(scores, scoresItem)
    }

    result := badgeScores(scores, m, g, t)

    for i, resultItem := range result {
        fmt.Fprintf(writer, "%d", resultItem)

        if i != len(result) - 1 {
            fmt.Fprintf(writer, "\n")
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
