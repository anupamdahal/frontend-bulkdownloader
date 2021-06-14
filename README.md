# frontend-bulkdownloader

To test this download functionality create files to download first. Run the file generator files

```
download/file-generator.sh
```

Serve the download file using the following command in /download folder

```
http-server -p 3000 --cors
```

To install http-server use the following command

```
npm install http-server -g
```

Finally server the application in another port by running the following command in /fetch folder

```
http-server -p 3001
```
