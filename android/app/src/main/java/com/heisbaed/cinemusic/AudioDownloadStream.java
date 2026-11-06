package com.heisbaed.cinemusic;

import java.io.*;
import java.net.HttpURLConnection;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.regex.*;

/** Sequential bounded ranges avoid treating a download as a real-time media stream. */
final class AudioDownloadStream extends InputStream {
    private static final long CHUNK = 1024 * 1024, MAX = 64L * 1024 * 1024;
    private final String url;
    private final BooleanSupplier cancelled;
    private final Consumer<HttpURLConnection> connected;
    private HttpURLConnection connection;
    private InputStream input;
    private long position, end, total = -1;
    private boolean closed;
    AudioDownloadStream(String url,BooleanSupplier cancelled,Consumer<HttpURLConnection> connected) throws Exception {
        this.url=url;this.cancelled=cancelled;this.connected=connected;open();
    }
    long length(){return total;}
    private void check() throws IOException {if(closed||cancelled.getAsBoolean()||Thread.currentThread().isInterrupted())throw new InterruptedIOException("Download stopped");}
    private void open() throws IOException {
        check();
        try {
            connection=MainActivity.connection(url);connected.accept(connection);check();
            connection.setConnectTimeout(5000);connection.setReadTimeout(10000);
            connection.setRequestProperty("User-Agent","Mozilla/5.0");connection.setRequestProperty("Referer","https://music.youtube.com/");
            connection.setRequestProperty("Range","bytes="+position+"-"+(total>0?Math.min(total-1,position+CHUNK-1):position+CHUNK-1));
            int status=connection.getResponseCode();
            String type=connection.getContentType();
            if(type==null||!(type.startsWith("audio/")||type.startsWith("video/webm")||type.startsWith("application/octet-stream")))throw new IOException("The server did not return audio");
            if(status==206){
                Matcher range=Pattern.compile("bytes (\\d+)-(\\d+)/(\\d+)").matcher(String.valueOf(connection.getHeaderField("Content-Range")));
                if(!range.matches()||Long.parseLong(range.group(1))!=position)throw new IOException("Invalid audio download range");
                long nextEnd=Long.parseLong(range.group(2)),size=Long.parseLong(range.group(3));
                if(size<=0||size>MAX||nextEnd<position||nextEnd>=size||nextEnd-position>=CHUNK||(total>0&&total!=size))throw new IOException("Invalid audio download size");
                total=size;end=nextEnd+1;
            }else if(status==200&&position==0){
                total=connection.getContentLengthLong();if(total<=0||total>MAX)throw new IOException("Invalid audio download size");end=total;
            }else throw new IOException("Download failed (HTTP "+status+"). Try again.");
            input=connection.getInputStream();
        }catch(Exception error){if(connection!=null)connection.disconnect();if(error instanceof IOException)throw (IOException)error;throw new IOException("Download connection failed",error);}
    }
    @Override public int read(byte[] bytes,int offset,int count) throws IOException {
        if(offset<0||count<0||offset>bytes.length-count)throw new IndexOutOfBoundsException();if(count==0)return 0;check();
        if(position==total)return -1;
        if(position==end){input.close();connection.disconnect();open();}
        int read=input.read(bytes,offset,(int)Math.min(count,end-position));
        if(read<0)throw new EOFException("Download was interrupted. Please retry.");position+=read;return read;
    }
    @Override public int read() throws IOException {byte[] one=new byte[1];return read(one,0,1)<0?-1:one[0]&255;}
    @Override public void close() throws IOException {closed=true;try{if(input!=null)input.close();}finally{if(connection!=null)connection.disconnect();}}
}
