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
 * Complete the 'countIslands' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER m
 *  2. INTEGER n
 *  3. 2D_INTEGER_ARRAY cells
 */

func countIslands(m int32, n int32, cells [][]int32) []int32 {
    // Write your code here
    return []int32{}
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)
    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    mTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    m := int32(mTemp)

    nTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    n := int32(nTemp)

    qTemp, err := strconv.ParseInt(firstMultipleInput[2], 10, 64)
    checkError(err)
    q := int32(qTemp)

    var cells [][]int32
    for i := 0; i < int(q); i++ {
        cellsRowTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

        var cellsRow []int32
        for _, cellsRowItem := range cellsRowTemp {
            cellsItemTemp, err := strconv.ParseInt(cellsRowItem, 10, 64)
            checkError(err)
            cellsItem := int32(cellsItemTemp)
            cellsRow = append(cellsRow, cellsItem)
        }

        if len(cellsRow) != 2 {
            panic("Bad input")
        }

        cells = append(cells, cellsRow)
    }

    result := countIslands(m, n, cells)

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
