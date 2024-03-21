# syntax=docker/dockerfile:1.4
FROM amazonlinux:2

RUN uname -m

RUN yum install -y amazon-linux-extras unzip && amazon-linux-extras install epel

# Install Redis Cli
RUN amazon-linux-extras enable redis4.0 && yum clean metadata && yum install -y redis

# Install AWS CLI
RUN curl -sOL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip \
    && unzip awscli-exe-linux-x86_64.zip \
    && ./aws/install