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
 * Complete the 'playlistQueries' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY tracks
 *  2. INTEGER d
 *  3. INTEGER_ARRAY positions
 */

func playlistQueries(tracks []int32, d int32, positions []int32) []int32 {
    // Write your code here
    return []int32{}
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)
    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    nTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    n := int32(nTemp)

    dTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    d := int32(dTemp)

    qTemp, err := strconv.ParseInt(firstMultipleInput[2], 10, 64)
    checkError(err)
    q := int32(qTemp)

    tracksTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var tracks []int32

    for i := 0; i < int(n); i++ {
        tracksItemTemp, err := strconv.ParseInt(tracksTemp[i], 10, 64)
        checkError(err)
        tracksItem := int32(tracksItemTemp)
        tracks = append(tracks, tracksItem)
    }

    positionsTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var positions []int32

    for i := 0; i < int(q); i++ {
        positionsItemTemp, err := strconv.ParseInt(positionsTemp[i], 10, 64)
        checkError(err)
        positionsItem := int32(positionsItemTemp)
        positions = append(positions, positionsItem)
    }

    result := playlistQueries(tracks, d, positions)

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
