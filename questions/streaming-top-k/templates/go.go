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
 * Complete the 'topTracks' function below.
 *
 * The function is expected to return a 2D_INTEGER_ARRAY.
 * The function accepts 2D_INTEGER_ARRAY events as parameter.
 */

func topTracks(events [][]int32) [][]int32 {
    // Write your code here
    return [][]int32{}
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
