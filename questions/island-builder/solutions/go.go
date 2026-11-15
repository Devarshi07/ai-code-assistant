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
    // Union-find over the m * n cells (cell id r * n + c); parent[x] == -1 marks water.
    rows, cols := int(m), int(n)
    parent := make([]int32, rows*cols)
    size := make([]int32, rows*cols)
    for i := range parent {
        parent[i] = -1
    }
    find := func(x int32) int32 {
        root := x
        for parent[root] != root {
            root = parent[root]
        }
        for parent[x] != root {
            next := parent[x]
            parent[x] = root
            x = next
        }
        return root
    }
    dr := [4]int{-1, 1, 0, 0}
    dc := [4]int{0, 0, -1, 1}
    var islands int32
    result := make([]int32, 0, len(cells))
    for _, raised := range cells {
        r, c := int(raised[0]), int(raised[1])
        cell := int32(r*cols + c)
        if parent[cell] == -1 {
            parent[cell] = cell
            size[cell] = 1
            islands++
            for d := 0; d < 4; d++ {
                nr, nc := r+dr[d], c+dc[d]
                if nr < 0 || nr >= rows || nc < 0 || nc >= cols || parent[nr*cols+nc] == -1 {
                    continue
                }
                a, b := find(cell), find(int32(nr*cols+nc))
                if a != b {
                    if size[a] < size[b] {
                        a, b = b, a
                    }
                    parent[b] = a
                    size[a] += size[b]
                    islands--
                }
            }
        }
        result = append(result, islands)
    }
    return result
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
