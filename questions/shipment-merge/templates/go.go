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
 * Complete the 'mergeShipments' function below.
 *
 * The function is expected to return a 2D_INTEGER_ARRAY.
 * The function accepts 2D_INTEGER_ARRAY windows as parameter.
 */

func mergeShipments(windows [][]int32) [][]int32 {
    // Write your code here
    return [][]int32{}
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)
    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    nTemp, err := strconv.ParseInt(strings.TrimSpace(readLine(reader)), 10, 64)
    checkError(err)
    n := int32(nTemp)

    var windows [][]int32
    for i := 0; i < int(n); i++ {
        windowsRowTemp := strings.Split(strings.TrimRight(readLine(reader), " \t\r\n"), " ")

        var windowsRow []int32
        for _, windowsRowItem := range windowsRowTemp {
            windowsItemTemp, err := strconv.ParseInt(windowsRowItem, 10, 64)
            checkError(err)
            windowsItem := int32(windowsItemTemp)
            windowsRow = append(windowsRow, windowsItem)
        }

        if len(windowsRow) != 2 {
            panic("Bad input")
        }

        windows = append(windows, windowsRow)
    }

    result := mergeShipments(windows)

    fmt.Fprintf(writer, "%d\n", len(result))

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
