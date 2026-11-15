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
 * Complete the 'processOperations' function below.
 *
 * The function is expected to return a LONG_INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY stock
 *  2. 2D_INTEGER_ARRAY operations
 */

func processOperations(stock []int32, operations [][]int32) []int64 {
    // Write your code here
    return []int64{}
}

func main() {
    reader := bufio.NewReaderSize(os.Stdin, 16 * 1024 * 1024)
    writer := bufio.NewWriterSize(os.Stdout, 16 * 1024 * 1024)

    firstMultipleInput := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    nTemp, err := strconv.ParseInt(firstMultipleInput[0], 10, 64)
    checkError(err)
    n := int32(nTemp)

    qTemp, err := strconv.ParseInt(firstMultipleInput[1], 10, 64)
    checkError(err)
    q := int32(qTemp)

    stockTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

    var stock []int32

    for i := 0; i < int(n); i++ {
        stockItemTemp, err := strconv.ParseInt(stockTemp[i], 10, 64)
        checkError(err)
        stockItem := int32(stockItemTemp)
        stock = append(stock, stockItem)
    }

    var operations [][]int32
    for i := 0; i < int(q); i++ {
        operationsRowTemp := strings.Split(strings.TrimSpace(readLine(reader)), " ")

        var operationsRow []int32
        for _, operationsRowItem := range operationsRowTemp {
            operationsItemTemp, err := strconv.ParseInt(operationsRowItem, 10, 64)
            checkError(err)
            operationsItem := int32(operationsItemTemp)
            operationsRow = append(operationsRow, operationsItem)
        }

        if len(operationsRow) != 3 {
            panic("Bad input")
        }

        operations = append(operations, operationsRow)
    }

    result := processOperations(stock, operations)

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
