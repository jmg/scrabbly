#!/usr/bin/env python
# -*- coding: utf-8 -*-
from setuptools import setup, find_packages
import os


setup(
    name="scrabbly",
    version="0.0.3",
    description="Scrabble engine",
    author="Juan Manuel García",
    author_email = "jmg.utn@gmail.com",
    license = "GPL v3",
    keywords = "Scrabble",
    packages=["scrabbly"],
    data_files=[("scrabbly", ["scrabbly/spanish.txt"]) ],
    install_requires=[
    ],
    url='',
)
