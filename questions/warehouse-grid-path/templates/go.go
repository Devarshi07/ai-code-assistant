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
 * Complete the 'shortestPath' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts STRING_ARRAY grid as parameter.
 */

func shortestPath(grid []string) int32 {
    // Write your code here
    return 0
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    rowsTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    rows := int32(rowsTemp)

    colsTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    cols := int32(colsTemp)

    var grid []string

    for i := 0; i < int(rows); i++ {
        gridItem := strings.TrimSpace(readLine(reader))

        if len(gridItem) != int(cols) {
            panic("Bad input")
        }

        grid = append(grid, gridItem)
    }

    result := shortestPath(grid)

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
